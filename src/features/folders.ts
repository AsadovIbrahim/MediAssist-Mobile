import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocalFile } from '../api/types';
import {
  deleteWorkspaceFileFromServer,
  isLocalFilePendingUpload,
  uploadWorkspaceFiles,
  workspaceServerStore,
} from './doctorWorkspace';

/**
 * Doctor's personal, hierarchical folders (synced with the server + cached locally).
 * Each folder can contain sub-folders and attachments (images, voice notes, documents).
 */
export interface DoctorFolder {
  id: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  text?: string;
  files: LocalFile[];
}

interface FoldersEnvelope {
  folders: DoctorFolder[];
  updatedAt: number;
  dirty?: boolean;
}

const STORAGE_KEY = 'mediassist.doctor.folders';

let cache: DoctorFolder[] | null = null;
let cachedUpdatedAt = 0;
let cachedDirty = false;
let mutationVersion = 0;
let syncingPromise: Promise<void> | null = null;
let pushQueued = false;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

export function subscribeFolders(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function hasPendingFiles(folders: DoctorFolder[]): boolean {
  return folders.some(folder => (folder.files ?? []).some(isLocalFilePendingUpload));
}

async function readLocalEnvelope(): Promise<FoldersEnvelope> {
  if (cache !== null) {
    return {
      folders: cache,
      updatedAt: cachedUpdatedAt,
      dirty: cachedDirty,
    };
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { folders: [], updatedAt: 0, dirty: false };
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        folders: parsed,
        updatedAt: Date.now(),
        dirty: parsed.length > 0,
      };
    }
    if (parsed && Array.isArray(parsed.folders)) {
      return {
        folders: parsed.folders,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
        dirty: Boolean(parsed.dirty),
      };
    }
  } catch {}
  return { folders: [], updatedAt: 0, dirty: false };
}

async function writeLocalEnvelope(envelope: FoldersEnvelope) {
  cache = envelope.folders;
  cachedUpdatedAt = envelope.updatedAt;
  cachedDirty = Boolean(envelope.dirty);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {}
  emit();
}

export async function loadFolders(triggerSync = false): Promise<DoctorFolder[]> {
  if (cache === null) {
    const env = await readLocalEnvelope();
    cache = env.folders;
    cachedUpdatedAt = env.updatedAt;
    cachedDirty = Boolean(env.dirty);
  }
  if (triggerSync) {
    syncFoldersWithServer().catch(() => {});
  }
  return cache;
}

export async function syncFoldersWithServer(): Promise<void> {
  if (syncingPromise) {
    return syncingPromise;
  }

  syncingPromise = (async () => {
    const versionAtStart = mutationVersion;
    try {
      const local = await readLocalEnvelope();
      if (cache === null) {
        cache = local.folders;
        cachedUpdatedAt = local.updatedAt;
        cachedDirty = Boolean(local.dirty);
      }

      if (cachedDirty || hasPendingFiles(cache)) {
        await pushFoldersToServerInternal();
        return;
      }

      const remote = await workspaceServerStore.loadFoldersPayload<FoldersEnvelope>();
      // Abort if user modified folders locally while network request was in flight
      if (mutationVersion !== versionAtStart || cachedDirty) {
        return;
      }

      if (remote && Array.isArray(remote.folders)) {
        const remoteTime = typeof remote.updatedAt === 'number' ? remote.updatedAt : 1;
        if ((cache?.length ?? 0) === 0 || remoteTime > cachedUpdatedAt) {
          await writeLocalEnvelope({
            folders: remote.folders,
            updatedAt: remoteTime,
            dirty: false,
          });
        }
      } else if ((cache?.length ?? 0) > 0) {
        // Back up existing local folders to the server
        await pushFoldersToServerInternal();
      }
    } catch {
      // Offline or unauthenticated; local cache remains active
    } finally {
      syncingPromise = null;
      if (pushQueued || cachedDirty) {
        pushQueued = false;
        pushFoldersToServer().catch(() => {});
      }
    }
  })();

  return syncingPromise;
}

async function pushFoldersToServerInternal(): Promise<void> {
  const snapshotFolders = [...(cache ?? (await readLocalEnvelope()).folders)];
  const versionBeforeUpload = mutationVersion;
  let anyFileUploaded = false;
  const uploadedByFolderId = new Map<string, LocalFile[]>();

  for (const folder of snapshotFolders) {
    const { files: syncedFiles, changed } = await uploadWorkspaceFiles(folder.files ?? []);
    if (changed) {
      anyFileUploaded = true;
      uploadedByFolderId.set(folder.id, syncedFiles);
    }
  }

  // Merge any uploaded file URLs into the latest cache without clobbering concurrent folder edits
  const latestFolders = (cache ?? snapshotFolders).map(folder => {
    const uploadedFiles = uploadedByFolderId.get(folder.id);
    if (!uploadedFiles) {
      return folder;
    }
    const byOldUri = new Map<string, LocalFile>();
    const snapFolder = snapshotFolders.find(f => f.id === folder.id);
    (snapFolder?.files ?? []).forEach((oldF, idx) => {
      if (uploadedFiles[idx]) {
        byOldUri.set(oldF.uri, uploadedFiles[idx]);
      }
    });
    return {
      ...folder,
      files: (folder.files ?? []).map(f => byOldUri.get(f.uri) ?? f),
    };
  });

  const stillPending = hasPendingFiles(latestFolders);
  const nextUpdatedAt = cachedUpdatedAt || Date.now();

  await workspaceServerStore.saveFoldersPayload(
    JSON.stringify({
      folders: latestFolders,
      updatedAt: nextUpdatedAt,
    }),
  );

  const mutatedDuringPush = mutationVersion !== versionBeforeUpload;
  if (anyFileUploaded || !mutatedDuringPush) {
    await writeLocalEnvelope({
      folders: latestFolders,
      updatedAt: nextUpdatedAt,
      dirty: stillPending || mutatedDuringPush,
    });
  }
}

export async function pushFoldersToServer(): Promise<void> {
  if (syncingPromise) {
    pushQueued = true;
    return syncingPromise;
  }
  syncingPromise = pushFoldersToServerInternal()
    .catch(() => {})
    .finally(() => {
      syncingPromise = null;
      if (pushQueued) {
        pushQueued = false;
        pushFoldersToServer().catch(() => {});
      }
    });
  return syncingPromise;
}

async function persist(next: DoctorFolder[]) {
  mutationVersion++;
  const now = Date.now();
  await writeLocalEnvelope({
    folders: next,
    updatedAt: now,
    dirty: true,
  });
  pushFoldersToServer().catch(() => {});
}

export async function createFolder(name: string, parentId: string | null) {
  const all = await loadFolders(false);
  const folder: DoctorFolder = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    parentId,
    name: name.trim(),
    createdAt: new Date().toISOString(),
    text: '',
    files: [],
  };
  await persist([...all, folder]);
  return folder;
}

export async function setFolderText(id: string, text: string) {
  const all = await loadFolders(false);
  await persist(all.map(f => (f.id === id ? { ...f, text } : f)));
}

export async function renameFolder(id: string, name: string) {
  const all = await loadFolders(false);
  await persist(all.map(f => (f.id === id ? { ...f, name: name.trim() } : f)));
}

/** Collects `id` and all of its nested descendant IDs so a folder cannot be moved into itself. */
export function getDescendantIds(all: DoctorFolder[], id: string): Set<string> {
  const ids = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of all) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
}

export async function moveFolder(id: string, newParentId: string | null) {
  const all = await loadFolders(false);
  const forbidden = getDescendantIds(all, id);
  if (newParentId && forbidden.has(newParentId)) {
    return;
  }
  await persist(all.map(f => (f.id === id ? { ...f, parentId: newParentId } : f)));
}

/** Deletes multiple folders together with all of their nested sub-folders and server files in a single batch. */
export async function deleteFolders(ids: string[]) {
  if (!ids.length) return;
  const all = await loadFolders(false);
  const toDelete = new Set<string>(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of all) {
      if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
        toDelete.add(f.id);
        grew = true;
      }
    }
  }

  const deletedFolders = all.filter(f => toDelete.has(f.id));
  await persist(all.filter(f => !toDelete.has(f.id)));

  for (const folder of deletedFolders) {
    for (const file of folder.files ?? []) {
      deleteWorkspaceFileFromServer(file).catch(() => {});
    }
  }
}

/** Deletes the folder together with all of its nested sub-folders and server files. */
export async function deleteFolder(id: string) {
  await deleteFolders([id]);
}

export async function setFolderFiles(id: string, files: LocalFile[]) {
  const all = await loadFolders(false);
  const existing = all.find(f => f.id === id);
  const nextUrls = new Set(files.map(f => f.uri));
  const removed = (existing?.files ?? []).filter(f => !nextUrls.has(f.uri));

  await persist(all.map(f => (f.id === id ? { ...f, files } : f)));

  for (const file of removed) {
    deleteWorkspaceFileFromServer(file).catch(() => {});
  }
}

export function childFolders(all: DoctorFolder[], parentId: string | null) {
  return all
    .filter(f => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
