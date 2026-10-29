import {
  FileText,
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
} from '../api/services';
import type { Complaint, Diagnosis, FileItem, LocalFile, Treatment } from '../api/types';
import type { ChipOption } from '../components/ui';
import type { TintName } from '../theme';
import { isAudioFile, isImageFile } from '../utils/media';

/**
 * Complaints, diagnoses and treatments share the same UI (list → form → detail).
 * This module describes the differences between them in one place.
 */
export type RecordKind = 'complaint' | 'diagnosis' | 'treatment';

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
  create: (dto: RecordInput<string>) => Promise<RecordItem>;
  remove: (id: string) => Promise<unknown>;
  upload: (id: string, file: LocalFile) => Promise<FileItem>;
  removeFile: (id: string, fileId: string) => Promise<unknown>;
}

export interface RecordConfig {
  title: string;
  singular: string;
  newTitle: string;
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

const fromComplaint = (c: Complaint): RecordItem => ({
  id: c.id,
  title: c.title,
  description: c.description,
  kind: c.type,
  date: c.createdAt,
  files: c.attachments ?? [],
});

const fromDoc = (d: Diagnosis | Treatment): RecordItem => ({
  id: d.id,
  title: d.title,
  description: d.description,
  kind: d.category,
  date: d.date || d.createdAt,
  files: d.documents ?? [],
});

const ALL = 'All';

export const RECORDS: Record<RecordKind, RecordConfig> = {
  complaint: {
    title: 'Şikayətlər',
    singular: 'Şikayət',
    newTitle: 'Yeni şikayət',
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
      list: async (p, f, s) => (await complaintsApi.list(p, f, s)).map(fromComplaint),
      get: async id => fromComplaint(await complaintsApi.get(id)),
      create: async dto =>
        fromComplaint(await complaintsApi.create(dto as RecordInput<Complaint['type']>)),
      remove: complaintsApi.remove,
      upload: complaintsApi.upload,
      removeFile: complaintsApi.removeFile,
    },
  },
  diagnosis: {
    title: 'Diaqnoz',
    singular: 'Diaqnoz',
    newTitle: 'Yeni diaqnoz',
    searchPlaceholder: 'Diaqnoz axtar...',
    descriptionLabel: 'Təsvir',
    descriptionPlaceholder: 'Diaqnoz haqqında qeydlər...',
    titlePlaceholder: 'Məs: Qan analizi nəticəsi',
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
      list: async (p, f, s) => (await diagnosesApi.list(p, f, s)).map(fromDoc),
      get: async id => fromDoc(await diagnosesApi.get(id)),
      create: async dto =>
        fromDoc(await diagnosesApi.create(dto as RecordInput<Diagnosis['category']>)),
      remove: diagnosesApi.remove,
      upload: diagnosesApi.upload,
      removeFile: diagnosesApi.removeFile,
    },
  },
  treatment: {
    title: 'Müalicə',
    singular: 'Müalicə',
    newTitle: 'Yeni müalicə',
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
      list: async (p, f, s) => (await treatmentsApi.list(p, f, s)).map(fromDoc),
      get: async id => fromDoc(await treatmentsApi.get(id)),
      create: async dto =>
        fromDoc(await treatmentsApi.create(dto as RecordInput<Treatment['category']>)),
      remove: treatmentsApi.remove,
      upload: treatmentsApi.upload,
      removeFile: treatmentsApi.removeFile,
    },
  },
};

export const ALL_FILTER = ALL;

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

