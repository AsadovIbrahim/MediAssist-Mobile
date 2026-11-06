import { fileUrl, http } from '../api/client';
import {
  complaintsApi,
  diagnosesApi,
  isSystemWorkspacePatient,
  SYSTEM_WORKSPACE_FIRST_NAME,
  SYSTEM_WORKSPACE_LAST_NAME,
} from '../api/services';
import type { Complaint, Diagnosis, LocalFile, Patient } from '../api/types';

const NOTE_RECORD_TITLE = '__MEDIASSIST_NOTE__';
const FOLDERS_RECORD_TITLE = '__MEDIASSIST_FOLDERS__';
const AUDIO_CONTAINER_TITLE = '__MEDIASSIST_AUDIO_BUCKET__';
const DOCS_CONTAINER_TITLE = '__MEDIASSIST_DOCS_BUCKET__';

let cachedWorkspacePatientId: string | null = null;
let workspacePatientPromise: Promise<string> | null = null;
let cachedAudioContainerId: string | null = null;
let cachedDocsContainerId: string | null = null;

export function resetWorkspaceMemoryCache() {
  cachedWorkspacePatientId = null;
  workspacePatientPromise = null;
  cachedAudioContainerId = null;
  cachedDocsContainerId = null;
}

/**
 * Finds or creates the hidden system patient record on the backend
 * that holds the logged-in doctor's personal Scratchpad (Qeyd) and Folders (Qovluq).
 */
export async function ensureWorkspacePatientId(): Promise<string> {
  if (cachedWorkspacePatientId) {
    return cachedWorkspacePatientId;
  }
  if (workspacePatientPromise) {
    return workspacePatientPromise;
  }

  workspacePatientPromise = (async () => {
    try {
      const all = await http.get<Patient[]>('patients');
      const existing = all.find(p => isSystemWorkspacePatient(p));
      if (existing) {
        cachedWorkspacePatientId = existing.id;
        return existing.id;
      }

      const created = await http.post<Patient>('patients', {
        firstName: SYSTEM_WORKSPACE_FIRST_NAME,
        lastName: SYSTEM_WORKSPACE_LAST_NAME,
        phone: '0000000000',
        dateOfBirth: null,
        note: null,
      });
      cachedWorkspacePatientId = created.id;
      return created.id;
    } finally {
      workspacePatientPromise = null;
    }
  })();

  return workspacePatientPromise;
}

async function ensureAudioContainerId(patientId: string): Promise<string> {
  if (cachedAudioContainerId) {
    return cachedAudioContainerId;
  }
  const list = await complaintsApi.list(patientId);
  const existing = list.find((c: Complaint) => c.title === AUDIO_CONTAINER_TITLE);
  if (existing) {
    cachedAudioContainerId = existing.id;
    return existing.id;
  }
  const created = await complaintsApi.create({
    patientId,
    title: AUDIO_CONTAINER_TITLE,
    description: null,
    kind: 'Voice',
    date: new Date().toISOString(),
  });
  cachedAudioContainerId = created.id;
  return created.id;
}

async function ensureDocsContainerId(patientId: string): Promise<string> {
  if (cachedDocsContainerId) {
    return cachedDocsContainerId;
  }
  const list = await diagnosesApi.list(patientId);
  const existing = list.find((d: Diagnosis) => d.title === DOCS_CONTAINER_TITLE);
  if (existing) {
    cachedDocsContainerId = existing.id;
    return existing.id;
  }
  const created = await diagnosesApi.create({
    patientId,
    title: DOCS_CONTAINER_TITLE,
    description: null,
    kind: 'Document',
    date: new Date().toISOString(),
  });
  cachedDocsContainerId = created.id;
  return created.id;
}

export function isLocalFilePendingUpload(file: LocalFile): boolean {
  if (file.serverFileId && /^https?:\/\//i.test(file.uri)) {
    return false;
  }
  return (
    !file.serverFileId ||
    file.uri.startsWith('file://') ||
    file.uri.startsWith('content://') ||
    !/^https?:\/\//i.test(file.uri)
  );
}

/**
 * Uploads any pending local files (voice recordings, images, documents)
 * to the backend server and returns the updated LocalFile array with remote URLs.
 */
export async function uploadWorkspaceFiles(files: LocalFile[]): Promise<{
  files: LocalFile[];
  changed: boolean;
}> {
  if (!files.some(isLocalFilePendingUpload)) {
    return { files, changed: false };
  }

  const patientId = await ensureWorkspacePatientId();
  let changed = false;
  const result: LocalFile[] = [];

  for (const file of files) {
    if (!isLocalFilePendingUpload(file)) {
      result.push(file);
      continue;
    }

    const onDeviceUri =
      file.localUri ||
      (file.uri.startsWith('file://') || file.uri.startsWith('content://')
        ? file.uri
        : undefined);

    try {
      if (file.kind === 'audio') {
        const containerId = await ensureAudioContainerId(patientId);
        const uploaded = await complaintsApi.upload(containerId, file);
        const remoteUri = fileUrl(uploaded.filePath) ?? file.uri;
        result.push({
          ...file,
          uri: remoteUri,
          localUri: onDeviceUri,
          size: uploaded.fileSize || file.size,
          serverFileId: uploaded.id,
          serverRecordId: containerId,
          serverBucket: 'complaint',
        });
        changed = true;
      } else {
        const containerId = await ensureDocsContainerId(patientId);
        const uploaded = await diagnosesApi.upload(containerId, file);
        const remoteUri = fileUrl(uploaded.filePath) ?? file.uri;
        result.push({
          ...file,
          uri: remoteUri,
          localUri: onDeviceUri,
          size: uploaded.fileSize || file.size,
          serverFileId: uploaded.id,
          serverRecordId: containerId,
          serverBucket: 'diagnosis',
        });
        changed = true;
      }
    } catch {
      // Keep local file if upload fails (e.g. offline); will retry on next sync
      result.push({
        ...file,
        localUri: onDeviceUri,
      });
    }
  }

  return { files: result, changed };
}

/**
 * Deletes an uploaded workspace file from the backend server in the background.
 */
export async function deleteWorkspaceFileFromServer(file: LocalFile): Promise<void> {
  if (!file.serverFileId || !file.serverRecordId) {
    return;
  }
  try {
    if (file.serverBucket === 'complaint') {
      await complaintsApi.removeFile(file.serverRecordId, file.serverFileId);
    } else {
      await diagnosesApi.removeFile(file.serverRecordId, file.serverFileId);
    }
  } catch {
    // Ignore if already deleted or offline
  }
}

async function getNamedDiagnosisRecord(
  patientId: string,
  title: string,
): Promise<Diagnosis | null> {
  const list = await diagnosesApi.list(patientId);
  return list.find((d: Diagnosis) => d.title === title) ?? null;
}

async function saveNamedDiagnosisPayload(
  title: string,
  category: 'Note' | 'Document',
  payloadJson: string,
): Promise<void> {
  const patientId = await ensureWorkspacePatientId();
  const existing = await getNamedDiagnosisRecord(patientId, title);
  const nowIso = new Date().toISOString();
  if (existing) {
    await diagnosesApi.update(existing.id, {
      title,
      description: payloadJson,
      kind: category,
      date: existing.date || nowIso,
    });
  } else {
    await diagnosesApi.create({
      patientId,
      title,
      description: payloadJson,
      kind: category,
      date: nowIso,
    });
  }
}

async function loadNamedDiagnosisPayload<T>(title: string): Promise<T | null> {
  const patientId = await ensureWorkspacePatientId();
  const existing = await getNamedDiagnosisRecord(patientId, title);
  if (!existing?.description) {
    return null;
  }
  try {
    return JSON.parse(existing.description) as T;
  } catch {
    return null;
  }
}

export const workspaceServerStore = {
  saveNotePayload: (json: string) =>
    saveNamedDiagnosisPayload(NOTE_RECORD_TITLE, 'Note', json),
  loadNotePayload: <T>() => loadNamedDiagnosisPayload<T>(NOTE_RECORD_TITLE),
  saveFoldersPayload: (json: string) =>
    saveNamedDiagnosisPayload(FOLDERS_RECORD_TITLE, 'Document', json),
  loadFoldersPayload: <T>() => loadNamedDiagnosisPayload<T>(FOLDERS_RECORD_TITLE),
};

