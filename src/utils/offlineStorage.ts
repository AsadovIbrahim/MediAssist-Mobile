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
    return newItem;
  },

  async dequeue(id: string): Promise<void> {
    const queue = await this.getQueue();
    const updated = queue.filter(q => q.id !== id);
    await AsyncStorage.setItem(`${PREFIX}queue`, JSON.stringify(updated));
  },

  async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(`${PREFIX}queue`);
  },
};
