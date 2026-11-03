import {
  FileText,
  FlaskConical,
  Image as ImageIcon,
  Mic,
  NotebookPen,
  Pill,
  type LucideIcon,
} from 'lucide-react-native';
import {
  complaintsApi,
  diagnosesApi,
  treatmentsApi,
  type RecordInput,
  type RecordUpdateInput,
} from '../api/services';
import type { Complaint, Diagnosis, FileItem, LocalFile, Treatment } from '../api/types';
import type { ChipOption } from '../components/ui';
import type { TranslationKey } from '../context/LanguageContext';
import type { TintName } from '../theme';
import { isAudioFile, isImageFile } from '../utils/media';
import { offlineStorage } from '../utils/offlineStorage';

/**
 * Complaints, diagnoses and treatments share the same UI (list → form → detail).
 * This module describes the differences between them in one place.
 */
export type RecordKind = 'complaint' | 'examination' | 'diagnosis' | 'treatment';

/** Normalized record used by the shared screens. */
export interface RecordItem {
  id: string;
  title: string;
  description: string | null;
  /** complaint.type | diagnosis.category | treatment.category */
  kind: string;
  date: string;
  files: FileItem[];
}

export type UploadSource = 'gallery' | 'camera' | 'voice' | 'document';

interface RecordApi {
  list: (patientId: string, filter?: string, search?: string) => Promise<RecordItem[]>;
  get: (id: string) => Promise<RecordItem>;
  create: (dto: RecordInput<string>, files?: LocalFile[]) => Promise<RecordItem>;
  update: (id: string, dto: RecordInput<string>, files?: LocalFile[]) => Promise<RecordItem>;
  remove: (id: string) => Promise<unknown>;
  upload: (id: string, file: LocalFile) => Promise<FileItem>;
  removeFile: (id: string, fileId: string) => Promise<unknown>;
}

export interface RecordConfig {
  title: string;
  singular: string;
  newTitle: string;
  editTitle: string;
  searchPlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  titlePlaceholder: string;
  filters: ChipOption<string>[];
  kinds: ChipOption<string>[];
  defaultKind: string;
  hasDate: boolean;
  sources: UploadSource[];
  emptyText: string;
  api: RecordApi;
}

export const fromComplaint = (c: Complaint): RecordItem => ({
  id: c.id,
  title: c.title,
  description: c.description,
  kind: c.type,
  date: c.createdAt,
  files: c.attachments ?? [],
});

export const fromDoc = (d: Diagnosis | Treatment): RecordItem => ({
  id: d.id,
  title: d.title,
  description: d.description,
  kind: d.category,
  date: d.date || d.createdAt,
  files: d.documents ?? [],
});

export const fromExamination = (d: Diagnosis): RecordItem => ({
  id: d.id,
  title: d.title,
  description: d.description
    ? d.description.replace(/^\[Müayinə\]\n?/, '').trim() || null
    : null,
  kind: d.category,
  date: d.date || d.createdAt,
  files: d.documents ?? [],
});

const ALL = 'All';

async function cachedList(
  patientId: string,
  kind: RecordKind,
  filter: string | undefined,
  search: string | undefined,
  fetcher: () => Promise<RecordItem[]>,
): Promise<RecordItem[]> {
  try {
    const remote = await fetcher();
    const queue = await offlineStorage.getQueue();
    const pendingIds = new Set(
      queue
        .filter(
          q =>
            q.type === 'create_record' &&
            q.recordKind === kind &&
            q.patientId === patientId,
        )
        .map(q => q.recordId)
        .filter(Boolean),
    );

    const cached = await offlineStorage.getRecords(patientId, kind);
    // Keep only local items that are strictly still pending in the queue
    const localPending = (cached || []).filter(
      r => r.id.startsWith('local_') && pendingIds.has(r.id),
    );

    // Drop any local item if remote already contains the same title
    const remoteTitles = new Set(
      remote.map(r => r.title.trim().toLowerCase()),
    );
    const unSyncedLocal = localPending.filter(
      r => !remoteTitles.has(r.title.trim().toLowerCase()),
    );

    // Combine and ensure unique IDs
    const seenIds = new Set<string>();
    const merged: RecordItem[] = [];
    for (const r of [...unSyncedLocal, ...remote]) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        merged.push(r);
      }
    }

    if (!filter && !search) {
      await offlineStorage.saveRecords(patientId, kind, merged);
    }

    let list = merged;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        r =>
          r.title.toLowerCase().includes(s) ||
          (r.description && r.description.toLowerCase().includes(s)),
      );
    }
    if (filter && filter !== ALL) {
      list = list.filter(r => r.kind === filter);
    }
    return list;
  } catch (e: any) {
    if (e?.status === 0 || !e?.status) {
      const cached = await offlineStorage.getRecords(patientId, kind);
      if (cached) {
        const seenIds = new Set<string>();
        let list = cached.filter(r => {
          if (seenIds.has(r.id)) return false;
          seenIds.add(r.id);
          return true;
        });
        if (search) {
          const s = search.toLowerCase();
          list = list.filter(
            r =>
              r.title.toLowerCase().includes(s) ||
              (r.description && r.description.toLowerCase().includes(s)),
          );
        }
        if (filter && filter !== ALL) {
          list = list.filter(r => r.kind === filter);
        }
        return list;
      }
    }
    throw e;
  }
}

async function cachedCreate(
  patientId: string,
  kind: RecordKind,
  dto: RecordInput<any>,
  creator: () => Promise<RecordItem>,
  files?: LocalFile[],
): Promise<RecordItem> {
  try {
    const created = await creator();
    const cached = (await offlineStorage.getRecords(patientId, kind)) || [];
    await offlineStorage.saveRecords(patientId, kind, [created, ...cached]);
    return created;
  } catch (e: any) {
    if (e?.status === 0 || !e?.status) {
      const localFiles: FileItem[] = (files || []).map((f, idx) => ({
        id: `local_file_${Date.now()}_${idx}`,
        fileName: f.name,
        filePath: f.uri,
        fileSize: f.size || 0,
        type: f.type.startsWith('image/')
          ? 'Image'
          : f.type.startsWith('audio/')
          ? 'VoiceRecording'
          : 'Document',
      }));
      const localId = `local_${kind}_${Date.now()}`;
      const localItem: RecordItem = {
        id: localId,
        title: dto.title,
        description: dto.description,
        kind: dto.kind,
        date: dto.date || new Date().toISOString(),
        files: localFiles,
      };
      const cached = (await offlineStorage.getRecords(patientId, kind)) || [];
      await offlineStorage.saveRecords(patientId, kind, [localItem, ...cached]);
      await offlineStorage.enqueue({
        type: 'create_record',
        recordKind: kind,
        recordId: localId,
        patientId,
        payload: dto,
        files,
      });
      return localItem;
    }
    throw e;
  }
}

async function cachedUpdate(
  id: string,
  kind: RecordKind,
  dto: RecordUpdateInput<any>,
  updater: () => Promise<RecordItem>,
  files?: LocalFile[],
): Promise<RecordItem> {
  try {
    return await updater();
  } catch (e: any) {
    if (e?.status === 0 || !e?.status) {
      const localFiles: FileItem[] = (files || []).map((f, idx) => ({
        id: `local_file_${Date.now()}_${idx}`,
        fileName: f.name,
        filePath: f.uri,
        fileSize: f.size || 0,
        type: f.type.startsWith('image/')
          ? 'Image'
          : f.type.startsWith('audio/')
          ? 'VoiceRecording'
          : 'Document',
      }));
      await offlineStorage.enqueue({
        type: 'update_record',
        recordKind: kind,
        recordId: id,
        payload: dto,
        files,
      });
      const cached = await offlineStorage.findRecord(id);
      const updatedItem: RecordItem = {
        id,
        title: dto.title,
        description: dto.description,
        kind: dto.kind,
        date: dto.date || new Date().toISOString(),
        files: [...(cached?.files || []), ...localFiles],
      };
      await offlineStorage.updateRecordInCache(id, updatedItem);
      return updatedItem;
    }
    throw e;
  }
}

async function cachedGet(
  id: string,
  fetcher: () => Promise<RecordItem>,
): Promise<RecordItem> {
  try {
    return await fetcher();
  } catch (e: any) {
    if (e?.status === 0 || !e?.status || id.startsWith('local_')) {
      const cached = await offlineStorage.findRecord(id);
      if (cached) return cached;
    }
    throw e;
  }
}

export const RECORDS: Record<RecordKind, RecordConfig> = {
  complaint: {
    title: 'Şikayətlər',
    singular: 'Şikayət',
    newTitle: 'Yeni şikayət',
    editTitle: 'Şikayəti redaktə et',
    searchPlaceholder: 'Şikayət axtar...',
    descriptionLabel: 'Şikayətin təsviri',
    descriptionPlaceholder: 'Şikayəti ətraflı təsvir edin...',
    titlePlaceholder: 'Məs: Baş ağrısı',
    filters: [
      { value: ALL, label: 'Hamısı' },
      { value: 'Text', label: 'Yazılı' },
      { value: 'Image', label: 'Şəkil' },
      { value: 'Voice', label: 'Səs' },
    ],
    kinds: [
      { value: 'Text', label: 'Yazılı' },
      { value: 'Image', label: 'Şəkil' },
      { value: 'Voice', label: 'Səs' },
    ],
    defaultKind: 'Text',
    hasDate: false,
    sources: ['gallery', 'camera', 'voice'],
    emptyText: 'Hələ şikayət əlavə edilməyib.',
    api: {
      list: (p, f, s) =>
        cachedList(p, 'complaint', f, s, async () =>
          (await complaintsApi.list(p, f, s)).map(fromComplaint),
        ),
      get: async id => cachedGet(id, async () => fromComplaint(await complaintsApi.get(id))),
      create: (dto, files) =>
        cachedCreate(dto.patientId, 'complaint', dto, async () =>
          fromComplaint(await complaintsApi.create(dto as RecordInput<Complaint['type']>)),
          files,
        ),
      update: (id, dto, files) =>
        cachedUpdate(id, 'complaint', dto, async () =>
          fromComplaint(
            await complaintsApi.update(id, {
              title: dto.title,
              description: dto.description,
              kind: dto.kind as Complaint['type'],
            }),
          ),
          files,
        ),
      remove: complaintsApi.remove,
      upload: complaintsApi.upload,
      removeFile: complaintsApi.removeFile,
    },
  },
  examination: {
    title: 'Müayinələr',
    singular: 'Müayinə',
    newTitle: 'Yeni müayinə',
    editTitle: 'Müayinəni redaktə et',
    searchPlaceholder: 'Müayinə və ya analiz axtar...',
    descriptionLabel: 'Müayinə təsviri / Nəticə',
    descriptionPlaceholder: 'Müayinə nəticələri, laboratoriya göstəriciləri...',
    titlePlaceholder: 'Məs: Qan analizi / USM / Rentgen',
    filters: [
      { value: ALL, label: 'Hamısı' },
      { value: 'Document', label: 'Sənədlər' },
      { value: 'Image', label: 'Şəkillər' },
      { value: 'Note', label: 'Qeydlər' },
    ],
    kinds: [
      { value: 'Document', label: 'Sənəd' },
      { value: 'Image', label: 'Şəkil' },
      { value: 'Note', label: 'Qeyd' },
    ],
    defaultKind: 'Document',
    hasDate: true,
    sources: ['gallery', 'camera', 'document'],
    emptyText: 'Hələ müayinə və ya analiz sənədi əlavə edilməyib.',
    api: {
      list: (p, _f, s) =>
        cachedList(p, 'examination', undefined, s, async () => {
          const all = await diagnosesApi.list(p, undefined, s);
          return all
            .filter(d => d.description?.startsWith('[Müayinə]'))
            .map(fromExamination);
        }),
      get: async id => cachedGet(id, async () => fromExamination(await diagnosesApi.get(id))),
      create: (dto, files) => {
        const desc = dto.description ? `[Müayinə]\n${dto.description}` : '[Müayinə]';
        return cachedCreate(
          dto.patientId,
          'examination',
          dto,
          async () => {
            const created = await diagnosesApi.create({
              patientId: dto.patientId,
              title: dto.title,
              description: desc,
              kind: (dto.kind as Diagnosis['category']) || 'Document',
              date: dto.date,
            });
            return fromExamination(created);
          },
          files,
        );
      },
      update: (id, dto, files) => {
        const desc = dto.description ? `[Müayinə]\n${dto.description}` : '[Müayinə]';
        return cachedUpdate(
          id,
          'examination',
          dto,
          async () =>
            fromExamination(
              await diagnosesApi.update(id, {
                title: dto.title,
                description: desc,
                kind: (dto.kind as Diagnosis['category']) || 'Document',
                date: dto.date,
              }),
            ),
          files,
        );
      },
      remove: diagnosesApi.remove,
      upload: diagnosesApi.upload,
      removeFile: diagnosesApi.removeFile,
    },
  },
  diagnosis: {
    title: 'Diaqnoz',
    singular: 'Diaqnoz',
    newTitle: 'Yeni diaqnoz',
    editTitle: 'Diaqnozu redaktə et',
    searchPlaceholder: 'Diaqnoz axtar...',
    descriptionLabel: 'Təsvir',
    descriptionPlaceholder: 'Diaqnoz haqqında qeydlər...',
    titlePlaceholder: 'Məs: Hipertoniya / Qastrit',
    filters: [
      { value: ALL, label: 'Hamısı' },
      { value: 'Document', label: 'Sənədlər' },
      { value: 'Image', label: 'Şəkillər' },
      { value: 'Note', label: 'Qeydlər' },
    ],
    kinds: [
      { value: 'Document', label: 'Sənəd' },
      { value: 'Image', label: 'Şəkil' },
      { value: 'Note', label: 'Qeyd' },
    ],
    defaultKind: 'Document',
    hasDate: true,
    sources: ['gallery', 'camera', 'document'],
    emptyText: 'Hələ diaqnoz sənədi əlavə edilməyib.',
    api: {
      list: (p, f, s) =>
        cachedList(p, 'diagnosis', f, s, async () => {
          const all = await diagnosesApi.list(p, f, s);
          return all
            .filter(d => !d.description?.startsWith('[Müayinə]'))
            .map(fromDoc);
        }),
      get: async id => cachedGet(id, async () => fromDoc(await diagnosesApi.get(id))),
      create: (dto, files) =>
        cachedCreate(dto.patientId, 'diagnosis', dto, async () =>
          fromDoc(await diagnosesApi.create(dto as RecordInput<Diagnosis['category']>)),
          files,
        ),
      update: (id, dto, files) =>
        cachedUpdate(id, 'diagnosis', dto, async () =>
          fromDoc(
            await diagnosesApi.update(id, {
              title: dto.title,
              description: dto.description,
              kind: (dto.kind as Diagnosis['category']) || 'Document',
              date: dto.date,
            }),
          ),
          files,
        ),
      remove: diagnosesApi.remove,
      upload: diagnosesApi.upload,
      removeFile: diagnosesApi.removeFile,
    },
  },
  treatment: {
    title: 'Müalicə',
    singular: 'Müalicə',
    newTitle: 'Yeni müalicə',
    editTitle: 'Müalicəni redaktə et',
    searchPlaceholder: 'Müalicə axtar...',
    descriptionLabel: 'Təsvir',
    descriptionPlaceholder: 'Dərmanlar, dozalar, tövsiyələr...',
    titlePlaceholder: 'Məs: Resept - Antibiotik',
    filters: [
      { value: ALL, label: 'Hamısı' },
      { value: 'Prescription', label: 'Reseptlər' },
      { value: 'Plan', label: 'Planlar' },
      { value: 'Note', label: 'Qeydlər' },
    ],
    kinds: [
      { value: 'Prescription', label: 'Resept' },
      { value: 'Plan', label: 'Plan' },
      { value: 'Note', label: 'Qeyd' },
    ],
    defaultKind: 'Prescription',
    hasDate: true,
    sources: ['gallery', 'camera', 'document'],
    emptyText: 'Hələ müalicə planı və ya resept əlavə edilməyib.',
    api: {
      list: (p, f, s) =>
        cachedList(p, 'treatment', f, s, async () =>
          (await treatmentsApi.list(p, f, s)).map(fromDoc),
        ),
      get: async id => cachedGet(id, async () => fromDoc(await treatmentsApi.get(id))),
      create: (dto, files) =>
        cachedCreate(dto.patientId, 'treatment', dto, async () =>
          fromDoc(await treatmentsApi.create(dto as RecordInput<Treatment['category']>)),
          files,
        ),
      update: (id, dto, files) =>
        cachedUpdate(id, 'treatment', dto, async () =>
          fromDoc(
            await treatmentsApi.update(id, {
              title: dto.title,
              description: dto.description,
              kind: (dto.kind as Treatment['category']) || 'Prescription',
              date: dto.date,
            }),
          ),
          files,
        ),
      remove: treatmentsApi.remove,
      upload: treatmentsApi.upload,
      removeFile: treatmentsApi.removeFile,
    },
  },
};

export const ALL_FILTER = ALL;

export function getRecordConfig(kind: RecordKind, t?: (k: TranslationKey) => string): RecordConfig {
  const base = RECORDS[kind];
  if (!t) {
    return base;
  }

  if (kind === 'complaint') {
    return {
      ...base,
      title: t('record.complaints'),
      singular: t('record.complaint'),
      newTitle: t('record.newComplaint'),
      editTitle: t('record.editComplaint'),
      searchPlaceholder: t('record.searchComplaint'),
      descriptionLabel: t('record.descComplaint'),
      descriptionPlaceholder: t('record.descComplaintPlh'),
      filters: [
        { value: ALL, label: t('record.filterAll') },
        { value: 'Text', label: t('record.filterText') },
        { value: 'Image', label: t('record.filterImage') },
        { value: 'Voice', label: t('record.filterVoice') },
      ],
      kinds: [
        { value: 'Text', label: t('record.filterText') },
        { value: 'Image', label: t('record.filterImage') },
        { value: 'Voice', label: t('record.filterVoice') },
      ],
      emptyText: t('record.emptyComplaint'),
    };
  }

  if (kind === 'examination') {
    return {
      ...base,
      title: t('record.examinations'),
      singular: t('record.examination'),
      newTitle: t('record.newExamination'),
      editTitle: t('record.editExamination'),
      searchPlaceholder: t('record.searchExamination'),
      descriptionLabel: t('record.descExamination'),
      descriptionPlaceholder: t('record.descExaminationPlh'),
      filters: [
        { value: ALL, label: t('record.filterAll') },
        { value: 'Document', label: t('record.filterDocuments') },
        { value: 'Image', label: t('record.filterImages') },
        { value: 'Note', label: t('record.filterNotes') },
      ],
      kinds: [
        { value: 'Document', label: t('record.filterDocument') },
        { value: 'Image', label: t('record.filterImage') },
        { value: 'Note', label: t('record.filterNote') },
      ],
      emptyText: t('record.emptyExamination'),
    };
  }

  if (kind === 'diagnosis') {
    return {
      ...base,
      title: t('record.diagnoses'),
      singular: t('record.diagnosis'),
      newTitle: t('record.newDiagnosis'),
      editTitle: t('record.editDiagnosis'),
      searchPlaceholder: t('record.searchDiagnosis'),
      descriptionLabel: t('record.descDiagnosis'),
      descriptionPlaceholder: t('record.descDiagnosisPlh'),
      filters: [
        { value: ALL, label: t('record.filterAll') },
        { value: 'Document', label: t('record.filterDocuments') },
        { value: 'Image', label: t('record.filterImages') },
        { value: 'Note', label: t('record.filterNotes') },
      ],
      kinds: [
        { value: 'Document', label: t('record.filterDocument') },
        { value: 'Image', label: t('record.filterImage') },
        { value: 'Note', label: t('record.filterNote') },
      ],
      emptyText: t('record.emptyDiagnosis'),
    };
  }

  return {
    ...base,
    title: t('record.treatments'),
    singular: t('record.treatment'),
    newTitle: t('record.newTreatment'),
    editTitle: t('record.editTreatment'),
    searchPlaceholder: t('record.searchTreatment'),
    descriptionLabel: t('record.descTreatment'),
    descriptionPlaceholder: t('record.descTreatmentPlh'),
    filters: [
      { value: ALL, label: t('record.filterAll') },
      { value: 'Prescription', label: t('record.filterPrescriptions') },
      { value: 'Plan', label: t('record.filterPlans') },
      { value: 'Note', label: t('record.filterNotes') },
    ],
    kinds: [
      { value: 'Prescription', label: t('record.filterPrescription') },
      { value: 'Plan', label: t('record.filterPlan') },
      { value: 'Note', label: t('record.filterNote') },
    ],
    emptyText: t('record.emptyTreatment'),
  };
}

export function splitFiles(files: FileItem[]) {
  const images = files.filter(f => isImageFile(f));
  const audios = files.filter(f => !isImageFile(f) && isAudioFile(f));
  const docs = files.filter(f => !isImageFile(f) && !isAudioFile(f));
  return { images, audios, docs };
}

/** Icon + colour of a list row, mirroring the mockups. */
export function recordVisual(kind: RecordKind, item: RecordItem): { icon: LucideIcon; tint: TintName } {
  const { images, audios, docs } = splitFiles(item.files);
  const onlyImages = images.length > 0 && audios.length === 0 && docs.length === 0;

  if (kind === 'complaint') {
    if (item.kind === 'Voice' || audios.length) {
      return { icon: Mic, tint: 'green' };
    }
    if (item.kind === 'Image' || onlyImages) {
      return { icon: ImageIcon, tint: 'purple' };
    }
    return { icon: FileText, tint: 'red' };
  }

  if (kind === 'examination') {
    if (item.kind === 'Image' || onlyImages) {
      return { icon: ImageIcon, tint: 'purple' };
    }
    return { icon: FlaskConical, tint: 'purple' };
  }

  if (kind === 'treatment' && item.kind === 'Prescription') {
    return { icon: Pill, tint: 'orange' };
  }
  if (item.kind === 'Image' || onlyImages) {
    return { icon: ImageIcon, tint: 'purple' };
  }
  if (item.kind === 'Note') {
    return docs.length ? { icon: FileText, tint: 'red' } : { icon: NotebookPen, tint: 'red' };
  }
  if (kind === 'treatment') {
    return { icon: FileText, tint: 'blue' };
  }
  return { icon: FileText, tint: 'green' };
}

const FILE_SUFFIX_REGEX = /\((?:Fayllı|With files|С файлами)\)$/i;
const VOICE_SUFFIX_REGEX = /\((?:Səs qeydi|Voice note|Голосовая запись)\)$/i;
const RECORD_SUFFIX_REGEX = /\b(?:qeydi|record|запись)$/i;

function detectKind(text: string, fallback?: RecordKind): RecordKind {
  const low = text.toLowerCase();
  if (low.includes('müayinə') || low.includes('examination') || low.includes('обследование')) {
    return 'examination';
  }
  if (low.includes('diaqnoz') || low.includes('diagnosis') || low.includes('диагноз')) {
    return 'diagnosis';
  }
  if (low.includes('şikayət') || low.includes('complaint') || low.includes('жалоб')) {
    return 'complaint';
  }
  if (low.includes('müalicə') || low.includes('treatment') || low.includes('лечени')) {
    return 'treatment';
  }
  return fallback ?? 'complaint';
}

export function isDefaultOrGenericRecordTitle(title?: string | null, kind?: RecordKind): boolean {
  if (!title) return true;
  const trimmed = title.trim();
  if (!trimmed) return true;

  if (
    FILE_SUFFIX_REGEX.test(trimmed) ||
    VOICE_SUFFIX_REGEX.test(trimmed) ||
    RECORD_SUFFIX_REGEX.test(trimmed)
  ) {
    return true;
  }

  const low = trimmed.toLowerCase();
  const genericWords = [
    'şikayət',
    'diaqnoz',
    'müayinə',
    'müalicə',
    'complaint',
    'diagnosis',
    'examination',
    'treatment',
    'жалоба',
    'диагноз',
    'обследование',
    'лечение',
  ];

  if (genericWords.includes(low)) {
    return true;
  }

  if (
    low.includes('(fayllı)') ||
    low.includes('(with files)') ||
    low.includes('(с файлами)') ||
    low.includes('(səs qeydi)') ||
    low.includes('(voice note)') ||
    low.includes('(голосовая запись)') ||
    low.endsWith('faylı') ||
    low.endsWith('şəkli') ||
    low.endsWith('səsi') ||
    low.endsWith('sənədi') ||
    low.endsWith('qeydi')
  ) {
    return true;
  }

  return false;
}

export function localizeRecordTitle(
  title: string,
  kind?: RecordKind,
  t?: (k: TranslationKey) => string,
): string {
  if (!t || !title) {
    return title;
  }
  const trimmed = title.trim();

  if (FILE_SUFFIX_REGEX.test(trimmed)) {
    const k = detectKind(trimmed, kind);
    return `${getRecordConfig(k, t).singular} ${t('record.fileSuffix')}`;
  }

  if (VOICE_SUFFIX_REGEX.test(trimmed)) {
    const k = detectKind(trimmed, kind);
    return `${getRecordConfig(k, t).singular} ${t('record.voiceSuffix')}`;
  }

  if (RECORD_SUFFIX_REGEX.test(trimmed)) {
    const k = detectKind(trimmed, kind);
    return `${getRecordConfig(k, t).singular} ${t('record.recordSuffix')}`;
  }

  const rawLow = trimmed.toLowerCase();
  if (
    rawLow === 'müayinə' ||
    rawLow === 'diaqnoz' ||
    rawLow === 'şikayət' ||
    rawLow === 'müalicə' ||
    rawLow === 'examination' ||
    rawLow === 'diagnosis' ||
    rawLow === 'complaint' ||
    rawLow === 'treatment' ||
    rawLow === 'обследование' ||
    rawLow === 'диагноз' ||
    rawLow === 'жалоба' ||
    rawLow === 'лечение'
  ) {
    const exactKind = detectKind(trimmed, kind);
    return getRecordConfig(exactKind, t).singular;
  }

  return title;
}

export function localizeAppointmentTitle(
  title: string,
  t?: (k: TranslationKey) => string,
): string {
  if (!t || !title) {
    return title;
  }
  const low = title.trim().toLowerCase();
  if (low === 'həkim müayinəsi' || low === 'doctor visit' || low === 'прием врача') {
    return t('appointment.doctorVisit');
  }
  if (
    low === 'qan analizi' ||
    low === 'lab test' ||
    low === 'анализ / лаборатория' ||
    low === 'анализ крови'
  ) {
    return t('appointment.labTest');
  }
  if (low === 'digər' || low === 'other' || low === 'другое') {
    return t('appointment.other');
  }
  return title;
}

