import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { apiConfig, http } from '../api/client';
import {
  appointmentsApi,
  complaintsApi,
  diagnosesApi,
  patientsApi,
  treatmentsApi,
} from '../api/services';
import type {
  Appointment,
  ComplaintType,
  DiagnosisCategory,
  LocalFile,
  Patient,
  TreatmentCategory,
} from '../api/types';
import {
  fromComplaint,
  fromDoc,
  fromExamination,
  type RecordItem,
} from '../features/records';
import {
  offlineStorage,
  subscribeQueueChange,
  type QueuedItem,
} from './offlineStorage';

type Listener = () => void;
type SyncListener = (succeeded: number) => void;

class OfflineSyncManager {
  private isSyncing = false;
  private syncPromise: Promise<{ succeeded: number; failed: number }> | null = null;
  private processingItemIds = new Set<string>();
  private listeners = new Set<Listener>();
  private syncCompletedListeners = new Set<SyncListener>();
  private online = true;
  private pendingCount = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.refreshPendingCount().then(count => {
      if (count > 0) {
        this.syncQueue();
      }
    });

    apiConfig.onConnectivity(online => {
      this.setOnlineStatus(online);
    });

    subscribeQueueChange(async () => {
      const count = await this.refreshPendingCount();
      if (count > 0 && this.online) {
        this.syncQueue();
      }
    });

    AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        this.refreshPendingCount().then(count => {
          if (count > 0) {
            this.syncQueue();
          }
        });
      }
    });

    this.intervalId = setInterval(() => {
      if (this.pendingCount > 0 && !this.isSyncing) {
        this.syncQueue();
      }
    }, 10000);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onSyncCompleted(listener: SyncListener): () => void {
    this.syncCompletedListeners.add(listener);
    return () => this.syncCompletedListeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => {
      try {
        l();
      } catch {}
    });
  }

  private notifySyncCompleted(succeeded: number) {
    this.syncCompletedListeners.forEach(l => {
      try {
        l(succeeded);
      } catch {}
    });
  }

  getIsOnline(): boolean {
    return this.online;
  }

  getPendingCount(): number {
    return this.pendingCount;
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  async setOnlineStatus(online: boolean) {
    if (this.online !== online) {
      this.online = online;
      this.notify();
      if (online) {
        const count = await this.refreshPendingCount();
        if (count > 0) {
          this.syncQueue();
        }
      }
    }
  }

  async refreshPendingCount(): Promise<number> {
    const queue = await offlineStorage.getQueue();
    this.pendingCount = queue.length;
    this.notify();
    return this.pendingCount;
  }

  syncQueue(): Promise<{ succeeded: number; failed: number }> {
    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.isSyncing = true;
    this.notify();

    this.syncPromise = this.doSync()
      .finally(() => {
        this.isSyncing = false;
        this.syncPromise = null;
        this.notify();
      });

    return this.syncPromise;
  }

  private async doSync(): Promise<{ succeeded: number; failed: number }> {
    const queue = await offlineStorage.getQueue();
    if (queue.length === 0) {
      this.pendingCount = 0;
      return { succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;

    for (const item of queue) {
      if (this.processingItemIds.has(item.id)) {
        continue;
      }
      this.processingItemIds.add(item.id);

      try {
        await this.processItem(item);
        await offlineStorage.dequeue(item.id);
        succeeded++;
      } catch (err: any) {
        // If it's a network error, stop syncing for now
        if (err?.status === 0 || err?.message?.includes('Serverlə əlaqə')) {
          this.online = false;
          failed++;
          break;
        } else {
          // If it's a non-retriable 4xx client error, dequeue it so queue isn't stuck
          if (err?.status >= 400 && err?.status < 500) {
            await offlineStorage.dequeue(item.id);
          }
          failed++;
        }
      } finally {
        this.processingItemIds.delete(item.id);
      }
    }

    await this.refreshPendingCount();

    if (succeeded > 0) {
      this.notifySyncCompleted(succeeded);
    }

    return { succeeded, failed };
  }

  private async processItem(item: QueuedItem): Promise<void> {
    switch (item.type) {
      case 'create_patient': {
        const created = await http.post<Patient>('patients', item.payload);
        if (item.files && item.files[0]) {
          await patientsApi.uploadPhoto(created.id, item.files[0]);
        }
        const currentPatients = (await offlineStorage.getPatients()) || [];
        const localId = item.recordId;
        const updated = currentPatients.map(p => {
          if (localId && p.id === localId) return created;
          if (
            !localId &&
            p.id.startsWith('local_p_') &&
            p.firstName === item.payload.firstName &&
            p.lastName === item.payload.lastName
          ) {
            return created;
          }
          return p;
        });
        if (!updated.some(p => p.id === created.id)) {
          updated.unshift(created);
        }
        await offlineStorage.savePatients(updated);
        break;
      }
      case 'update_patient': {
        if (item.patientId) {
          await http.put<Patient>(`patients/${item.patientId}`, item.payload);
          if (item.files && item.files[0]) {
            await patientsApi.uploadPhoto(item.patientId, item.files[0]);
          }
        }
        break;
      }
      case 'create_record': {
        if (!item.recordKind || !item.patientId) break;
        const kind = item.recordKind;
        const pId = item.patientId;
        let createdRecord: RecordItem | null = null;
        let serverId = '';

        if (kind === 'complaint') {
          const res = await complaintsApi.create({
            patientId: pId,
            title: item.payload.title,
            description: item.payload.description,
            kind: item.payload.kind as ComplaintType,
            date: item.payload.date || new Date().toISOString(),
          });
          serverId = res.id;
          if (item.files && item.files.length > 0) {
            for (const f of item.files) {
              await complaintsApi.upload(serverId, f);
            }
            const refreshed = await complaintsApi.get(serverId);
            createdRecord = fromComplaint(refreshed);
          } else {
            createdRecord = fromComplaint(res);
          }
        } else if (kind === 'examination') {
          const desc = item.payload.description
            ? (item.payload.description.startsWith('[Müayinə]')
                ? item.payload.description
                : `[Müayinə]\n${item.payload.description}`)
            : '[Müayinə]';
          const res = await diagnosesApi.create({
            patientId: pId,
            title: item.payload.title,
            description: desc,
            kind: (item.payload.kind as DiagnosisCategory) || 'Document',
            date: item.payload.date,
          });
          serverId = res.id;
          if (item.files && item.files.length > 0) {
            for (const f of item.files) {
              await diagnosesApi.upload(serverId, f);
            }
            const refreshed = await diagnosesApi.get(serverId);
            createdRecord = fromExamination(refreshed);
          } else {
            createdRecord = fromExamination(res);
          }
        } else if (kind === 'diagnosis') {
          const res = await diagnosesApi.create({
            patientId: pId,
            title: item.payload.title,
            description: item.payload.description,
            kind: (item.payload.kind as DiagnosisCategory) || 'Document',
            date: item.payload.date,
          });
          serverId = res.id;
          if (item.files && item.files.length > 0) {
            for (const f of item.files) {
              await diagnosesApi.upload(serverId, f);
            }
            const refreshed = await diagnosesApi.get(serverId);
            createdRecord = fromDoc(refreshed);
          } else {
            createdRecord = fromDoc(res);
          }
        } else if (kind === 'treatment') {
          const res = await treatmentsApi.create({
            patientId: pId,
            title: item.payload.title,
            description: item.payload.description,
            kind: (item.payload.kind as TreatmentCategory) || 'Prescription',
            date: item.payload.date,
          });
          serverId = res.id;
          if (item.files && item.files.length > 0) {
            for (const f of item.files) {
              await treatmentsApi.upload(serverId, f);
            }
            const refreshed = await treatmentsApi.get(serverId);
            createdRecord = fromDoc(refreshed);
          } else {
            createdRecord = fromDoc(res);
          }
        }

        if (createdRecord) {
          await offlineStorage.replaceRecordInCache(
            pId,
            kind,
            item.recordId,
            createdRecord,
          );
        }
        break;
      }
      case 'update_record': {
        if (!item.recordKind || !item.recordId) break;
        const kind = item.recordKind;
        const id = item.recordId;
        if (kind === 'complaint') {
          await complaintsApi.update(id, {
            title: item.payload.title,
            description: item.payload.description,
            kind: item.payload.kind as ComplaintType,
          });
          if (item.files && item.files.length > 0) {
            for (const f of item.files) {
              await complaintsApi.upload(id, f);
            }
          }
        } else if (kind === 'examination') {
          const desc = item.payload.description
            ? (item.payload.description.startsWith('[Müayinə]')
                ? item.payload.description
                : `[Müayinə]\n${item.payload.description}`)
            : '[Müayinə]';
          await diagnosesApi.update(id, {
            title: item.payload.title,
            description: desc,
            kind: (item.payload.kind as DiagnosisCategory) || 'Document',
            date: item.payload.date,
          });
          if (item.files && item.files.length > 0) {
            for (const f of item.files) {
              await diagnosesApi.upload(id, f);
            }
          }
        } else if (kind === 'diagnosis') {
          await diagnosesApi.update(id, {
            title: item.payload.title,
            description: item.payload.description,
            kind: (item.payload.kind as DiagnosisCategory) || 'Document',
            date: item.payload.date,
          });
          if (item.files && item.files.length > 0) {
            for (const f of item.files) {
              await diagnosesApi.upload(id, f);
            }
          }
        } else if (kind === 'treatment') {
          await treatmentsApi.update(id, {
            title: item.payload.title,
            description: item.payload.description,
            kind: (item.payload.kind as TreatmentCategory) || 'Prescription',
            date: item.payload.date,
          });
          if (item.files && item.files.length > 0) {
            for (const f of item.files) {
              await treatmentsApi.upload(id, f);
            }
          }
        }
        break;
      }
      case 'create_appointment': {
        const created = await http.post<Appointment>('appointments', item.payload);
        if (item.payload.patientId) {
          const currentApps =
            (await offlineStorage.getAppointments(item.payload.patientId)) || [];
          const localId = item.recordId;
          const updated = currentApps.map(a => {
            if (localId && a.id === localId) return created;
            if (!localId && a.id.startsWith('local_app_')) return created;
            return a;
          });
          if (!updated.some(a => a.id === created.id)) {
            updated.unshift(created);
          }
          await offlineStorage.saveAppointments(item.payload.patientId, updated);
        }
        break;
      }
      case 'update_appointment': {
        if (item.recordId) {
          await http.put<Appointment>(`appointments/${item.recordId}`, item.payload);
        }
        break;
      }
    }
  }
}

export const offlineSyncService = new OfflineSyncManager();

export function useOfflineSync() {
  const [online, setOnline] = useState(offlineSyncService.getIsOnline());
  const [pending, setPending] = useState(offlineSyncService.getPendingCount());
  const [syncing, setSyncing] = useState(offlineSyncService.getIsSyncing());

  useEffect(() => {
    return offlineSyncService.subscribe(() => {
      setOnline(offlineSyncService.getIsOnline());
      setPending(offlineSyncService.getPendingCount());
      setSyncing(offlineSyncService.getIsSyncing());
    });
  }, []);

  return {
    isOnline: online,
    pendingCount: pending,
    isSyncing: syncing,
    sync: () => offlineSyncService.syncQueue(),
  };
}
