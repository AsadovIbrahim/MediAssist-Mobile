import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Appointment, FileItem, LocalFile, Patient, PatientDashboard } from '../api/types';
import type { RecordItem, RecordKind } from '../features/records';

const PREFIX = 'mediassist.offline.';

export interface QueuedItem {
  id: string;
  type:
    | 'create_patient'
    | 'update_patient'
    | 'create_record'
    | 'update_record'
    | 'create_appointment'
    | 'update_appointment';
  patientId?: string;
  recordKind?: RecordKind;
  recordId?: string;
  payload: any;
  files?: LocalFile[];
  createdAt: number;
}

type QueueListener = () => void;
const queueListeners = new Set<QueueListener>();

export function subscribeQueueChange(listener: QueueListener): () => void {
  queueListeners.add(listener);
  return () => queueListeners.delete(listener);
}

function notifyQueueChange() {
  queueListeners.forEach(l => {
    try {
      l();
    } catch {}
  });
}

export const offlineStorage = {
  // ---- Patients Cache ----
  async savePatients(list: Patient[]): Promise<void> {
    try {
      await AsyncStorage.setItem(`${PREFIX}patients`, JSON.stringify(list));
    } catch {}
  },

  async getPatients(): Promise<Patient[] | null> {
    try {
      const raw = await AsyncStorage.getItem(`${PREFIX}patients`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  // ---- Records Cache (Complaints, Examinations, Diagnoses, Treatments) ----
  async saveRecords(patientId: string, kind: RecordKind, items: RecordItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(`${PREFIX}records.${patientId}.${kind}`, JSON.stringify(items));
    } catch {}
  },

  async getRecords(patientId: string, kind: RecordKind): Promise<RecordItem[] | null> {
    try {
      const raw = await AsyncStorage.getItem(`${PREFIX}records.${patientId}.${kind}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async findRecord(id: string): Promise<RecordItem | null> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const recordKeys = keys.filter(k => k.startsWith(`${PREFIX}records.`));
      for (const k of recordKeys) {
        const raw = await AsyncStorage.getItem(k);
        if (raw) {
          const list: RecordItem[] = JSON.parse(raw);
          const found = list.find(r => r.id === id);
          if (found) return found;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  async replaceRecordInCache(
    patientId: string,
    kind: RecordKind,
    oldId: string | undefined,
    newRecord: RecordItem,
  ): Promise<void> {
    try {
      const cached = (await this.getRecords(patientId, kind)) || [];
      const updated = cached.map(r => {
        if (oldId && r.id === oldId) return newRecord;
        if (!oldId && r.id.startsWith('local_') && r.title.trim().toLowerCase() === newRecord.title.trim().toLowerCase()) return newRecord;
        return r;
      });
      if (!updated.some(r => r.id === newRecord.id)) {
        updated.unshift(newRecord);
      }
      // Deduplicate: drop any residual local_ item matching this new record, and ensure unique IDs
      const seen = new Set<string>();
      const deduplicated: RecordItem[] = [];
      for (const item of updated) {
        if (
          item.id.startsWith('local_') &&
          item.title.trim().toLowerCase() === newRecord.title.trim().toLowerCase()
        ) {
          continue;
        }
        if (!seen.has(item.id)) {
          seen.add(item.id);
          deduplicated.push(item);
        }
      }
      await this.saveRecords(patientId, kind, deduplicated);
    } catch {}
  },

  async updateRecordInCache(id: string, updatedRecord: RecordItem): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const recordKeys = keys.filter(k => k.startsWith(`${PREFIX}records.`));
      for (const k of recordKeys) {
        const raw = await AsyncStorage.getItem(k);
        if (raw) {
          const list: RecordItem[] = JSON.parse(raw);
          const idx = list.findIndex(r => r.id === id);
          if (idx !== -1) {
            list[idx] = updatedRecord;
            await AsyncStorage.setItem(k, JSON.stringify(list));
            return;
          }
        }
      }
    } catch {}
  },

  // ---- Appointments Cache ----
  async saveAppointments(patientId: string, list: Appointment[]): Promise<void> {
    try {
      await AsyncStorage.setItem(`${PREFIX}appointments.${patientId}`, JSON.stringify(list));
    } catch {}
  },

  async getAppointments(patientId: string): Promise<Appointment[] | null> {
    try {
      const raw = await AsyncStorage.getItem(`${PREFIX}appointments.${patientId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  // ---- Dashboard Cache ----
  async saveDashboard(patientId: string, data: PatientDashboard): Promise<void> {
    try {
      await AsyncStorage.setItem(`${PREFIX}dashboard.${patientId}`, JSON.stringify(data));
    } catch {}
  },

  async getDashboard(patientId: string): Promise<PatientDashboard | null> {
    try {
      const raw = await AsyncStorage.getItem(`${PREFIX}dashboard.${patientId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  // ---- Offline Queue ----
  async getQueue(): Promise<QueuedItem[]> {
    try {
      const raw = await AsyncStorage.getItem(`${PREFIX}queue`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async enqueue(item: Omit<QueuedItem, 'id' | 'createdAt'>): Promise<QueuedItem> {
    const queue = await this.getQueue();
    const newItem: QueuedItem = {
      ...item,
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
    };
    queue.push(newItem);
    await AsyncStorage.setItem(`${PREFIX}queue`, JSON.stringify(queue));
    notifyQueueChange();
    return newItem;
  },

  async dequeue(id: string): Promise<void> {
    const queue = await this.getQueue();
    const updated = queue.filter(q => q.id !== id);
    await AsyncStorage.setItem(`${PREFIX}queue`, JSON.stringify(updated));
  },

  async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(`${PREFIX}queue`);
    notifyQueueChange();
  },
};
