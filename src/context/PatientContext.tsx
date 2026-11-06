import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { patientsApi } from '../api/services';
import type { Patient } from '../api/types';
import { storage } from '../utils/storage';
import { useAuth } from './AuthContext';

interface PatientContextValue {
  patients: Patient[];
  patient: Patient | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  select: (id: string) => Promise<void>;
}

const PatientContext = createContext<PatientContextValue | null>(null);

/**
 * The backend is doctor-centric: every complaint / diagnosis / treatment /
 * appointment belongs to a patient. This context keeps the currently
 * selected patient whose medical card is shown on the home screen.
 */
export function PatientProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await patientsApi.list();
      setPatients(list);
      const saved = await storage.getPatientId();
      setSelectedId(prev => {
        const wanted = prev ?? saved;
        if (wanted && list.some(p => p.id === wanted)) {
          return wanted;
        }
        return list[0]?.id ?? null;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      refresh();
    } else {
      setPatients([]);
      setSelectedId(null);
    }
  }, [user, refresh]);

  const select = useCallback(async (id: string) => {
    setSelectedId(id);
    await storage.setPatientId(id);
  }, []);

  const patient = useMemo(
    () => patients.find(p => p.id === selectedId) ?? null,
    [patients, selectedId],
  );

  const value = useMemo(
    () => ({ patients, patient, loading, error, refresh, select }),
    [patients, patient, loading, error, refresh, select],
  );

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>;
}

export function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) {
    throw new Error('usePatient must be used inside PatientProvider');
  }
  return ctx;
}

export function patientFullName(p: Pick<Patient, 'firstName' | 'lastName'> | null) {
  if (!p) {
    return '';
  }
  const last = p.lastName && p.lastName.trim() !== '-' ? p.lastName.trim() : '';
  return `${p.firstName.trim()} ${last}`.trim();
}

export function patientDisplayPhone(phone: string | null | undefined): string {
  if (!phone) {
    return '';
  }
  const trimmed = phone.trim();
  return trimmed === '-' ? '' : trimmed;
}

