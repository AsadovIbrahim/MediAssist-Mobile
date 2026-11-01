import { useEffect, useState } from 'react';
import { apiConfig } from '../api/client';
import { appointmentsApi, patientsApi } from '../api/services';
import type { LocalFile } from '../api/types';
import { RECORDS } from '../features/records';
import { offlineStorage, type QueuedItem } from './offlineStorage';

type Listener = () => void;

class OfflineSyncManager {
  private isSyncing = false;
  private listeners = new Set<Listener>();
  private online = true;
  private pendingCount = 0;

  constructor() {
    this.refreshPendingCount();
    apiConfig.onConnectivity(online => {
      this.setOnlineStatus(online);
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => {
      try {
        l();
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

  setOnlineStatus(online: boolean) {
    if (this.online !== online) {
      this.online = online;
      this.notify();
      if (online && this.pendingCount > 0) {
        this.syncQueue();
      }
    }
  }

  async refreshPendingCount(): Promise<number> {
    const queue = await offlineStorage.getQueue();
    this.pendingCount = queue.length;
    this.notify();
    return this.pendingCount;
  }

  async syncQueue(): Promise<{ succeeded: number; failed: number }> {
    if (this.isSyncing) {
      return { succeeded: 0, failed: 0 };
    }

    const queue = await offlineStorage.getQueue();
    if (queue.length === 0) {
      this.pendingCount = 0;
      this.notify();
      return { succeeded: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.notify();

    let succeeded = 0;
    let failed = 0;

    for (const item of queue) {
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
      }
    }

    await this.refreshPendingCount();
    this.isSyncing = false;
    this.notify();

    return { succeeded, failed };
  }

  private async processItem(item: QueuedItem): Promise<void> {
    switch (item.type) {
      case 'create_patient': {
        const created = await patientsApi.create(item.payload);
        if (item.files && item.files[0]) {
          await patientsApi.uploadPhoto(created.id, item.files[0]);
        }
        break;
      }
      case 'update_patient': {
        if (item.patientId) {
          await patientsApi.update(item.patientId, item.payload);
          if (item.files && item.files[0]) {
            await patientsApi.uploadPhoto(item.patientId, item.files[0]);
          }
        }
        break;
      }
      case 'create_record': {
        if (item.recordKind && RECORDS[item.recordKind]) {
          const cfg = RECORDS[item.recordKind];
          const created = await cfg.api.create(item.payload);
          if (item.files && item.files.length > 0) {
            for (const f of item.files) {
              await cfg.api.upload(created.id, f);
            }
          }
        }
        break;
      }
      case 'update_record': {
        if (item.recordKind && item.recordId && RECORDS[item.recordKind]) {
          const cfg = RECORDS[item.recordKind];
          await cfg.api.update(item.recordId, item.payload);
          if (item.files && item.files.length > 0) {
            for (const f of item.files) {
              await cfg.api.upload(item.recordId, f);
            }
          }
        }
        break;
      }
      case 'create_appointment': {
        await appointmentsApi.create(item.payload);
        break;
      }
      case 'update_appointment': {
        if (item.recordId) {
          await appointmentsApi.update(item.recordId, item.payload);
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
