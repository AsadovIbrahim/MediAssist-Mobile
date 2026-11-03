import { http } from './client';
import { offlineStorage } from '../utils/offlineStorage';
import type {
  Appointment,
  AppointmentInput,
  AuthResponse,
  Complaint,
  ComplaintType,
  CurrentUser,
  Diagnosis,
  DiagnosisCategory,
  FileItem,
  LocalFile,
  MessageResponse,
  Patient,
  PatientDashboard,
  PatientInput,
  RegisterDoctorRequest,
  RegisterOtpResponse,
  Treatment,
  TreatmentCategory,
} from './types';

export const authApi = {
  login: (email: string, password: string) =>
    http.post<AuthResponse>('auth/login', { email, password }),
  registerDoctor: (dto: RegisterDoctorRequest) =>
    http.post<RegisterOtpResponse>('auth/register-doctor', dto),
  verifyOtp: (email: string, otpCode: string) =>
    http.post<AuthResponse>('auth/verify-otp', { email, otpCode }),
  resendOtp: (email: string) =>
    http.post<RegisterOtpResponse>('auth/resend-otp', { email }),
  forgotPassword: (email: string) =>
    http.post<MessageResponse>('auth/forgot-password', { email }),
  verifyResetOtp: (email: string, otpCode: string) =>
    http.post<MessageResponse>('auth/verify-reset-otp', { email, otpCode }),
  resetPassword: (email: string, otpCode: string, newPassword: string) =>
    http.post<MessageResponse>('auth/reset-password', {
      email,
      otpCode,
      newPassword,
    }),
  me: () => http.get<CurrentUser>('auth/me'),
};

export const patientsApi = {
  list: async (search?: string): Promise<Patient[]> => {
    try {
      const remote = await http.get<Patient[]>('patients', { search });
      const queue = await offlineStorage.getQueue();
      const pendingIds = new Set(
        queue
          .filter(q => q.type === 'create_patient')
          .map(q => q.recordId)
          .filter(Boolean),
      );

      const cached = await offlineStorage.getPatients();
      const localPending = (cached || []).filter(
        p => p.id.startsWith('local_p_') && pendingIds.has(p.id),
      );

      const remoteKeys = new Set(
        remote.map(
          p => `${p.firstName} ${p.lastName} ${p.phone}`.toLowerCase(),
        ),
      );
      const unSyncedLocal = localPending.filter(
        p =>
          !remoteKeys.has(
            `${p.firstName} ${p.lastName} ${p.phone}`.toLowerCase(),
          ),
      );

      const seenIds = new Set<string>();
      const merged: Patient[] = [];
      for (const p of [...unSyncedLocal, ...remote]) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          merged.push(p);
        }
      }

      if (!search) {
        await offlineStorage.savePatients(merged);
      }

      if (search) {
        const s = search.toLowerCase();
        return merged.filter(
          p =>
            p.firstName.toLowerCase().includes(s) ||
            p.lastName.toLowerCase().includes(s) ||
            p.phone.includes(s),
        );
      }
      return merged;
    } catch (e: any) {
      if (e?.status === 0 || !e?.status) {
        const cached = await offlineStorage.getPatients();
        if (cached) {
          if (search) {
            const s = search.toLowerCase();
            return cached.filter(
              p =>
                p.firstName.toLowerCase().includes(s) ||
                p.lastName.toLowerCase().includes(s) ||
                p.phone.includes(s),
            );
          }
          return cached;
        }
      }
      throw e;
    }
  },
  get: async (id: string): Promise<Patient> => {
    try {
      return await http.get<Patient>(`patients/${id}`);
    } catch (e: any) {
      if (e?.status === 0 || !e?.status) {
        const cached = await offlineStorage.getPatients();
        const found = cached?.find(p => p.id === id);
        if (found) {
          return found;
        }
      }
      throw e;
    }
  },
  dashboard: async (id: string): Promise<PatientDashboard> => {
    try {
      const remote = await http.get<PatientDashboard>(`patients/${id}/dashboard`);
      await offlineStorage.saveDashboard(id, remote);
      return remote;
    } catch (e: any) {
      if (e?.status === 0 || !e?.status) {
        const cached = await offlineStorage.getDashboard(id);
        if (cached) {
          return cached;
        }
      }
      throw e;
    }
  },
  create: async (dto: PatientInput, photo?: LocalFile): Promise<Patient> => {
    try {
      const created = await http.post<Patient>('patients', dto);
      const cached = (await offlineStorage.getPatients()) || [];
      await offlineStorage.savePatients([created, ...cached]);
      return created;
    } catch (e: any) {
      if (e?.status === 0 || !e?.status) {
        const localPatient: Patient = {
          id: `local_p_${Date.now()}`,
          doctorId: '',
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          dateOfBirth: dto.dateOfBirth,
          age: dto.dateOfBirth
            ? new Date().getFullYear() - new Date(dto.dateOfBirth).getFullYear()
            : null,
          note: dto.note,
          photoUrl: photo?.uri ?? null,
          complaintCount: 0,
          diagnosisCount: 0,
          treatmentCount: 0,
          appointmentCount: 0,
          createdAt: new Date().toISOString(),
        };
        const cached = (await offlineStorage.getPatients()) || [];
        await offlineStorage.savePatients([localPatient, ...cached]);
        await offlineStorage.enqueue({
          type: 'create_patient',
          recordId: localPatient.id,
          payload: dto,
          files: photo ? [photo] : undefined,
        });
        return localPatient;
      }
      throw e;
    }
  },
  update: async (id: string, dto: PatientInput, photo?: LocalFile): Promise<Patient> => {
    try {
      const updated = await http.put<Patient>(`patients/${id}`, dto);
      const cached = (await offlineStorage.getPatients()) || [];
      await offlineStorage.savePatients(cached.map(p => (p.id === id ? updated : p)));
      return updated;
    } catch (e: any) {
      if (e?.status === 0 || !e?.status) {
        const cached = (await offlineStorage.getPatients()) || [];
        const existing = cached.find(p => p.id === id);
        const localUpdated: Patient = {
          id,
          doctorId: existing?.doctorId ?? '',
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          dateOfBirth: dto.dateOfBirth,
          age: dto.dateOfBirth
            ? new Date().getFullYear() - new Date(dto.dateOfBirth).getFullYear()
            : existing?.age ?? null,
          note: dto.note,
          photoUrl: photo?.uri ?? existing?.photoUrl ?? null,
          complaintCount: existing?.complaintCount ?? 0,
          diagnosisCount: existing?.diagnosisCount ?? 0,
          treatmentCount: existing?.treatmentCount ?? 0,
          appointmentCount: existing?.appointmentCount ?? 0,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        await offlineStorage.savePatients(cached.map(p => (p.id === id ? localUpdated : p)));
        await offlineStorage.enqueue({
          type: 'update_patient',
          patientId: id,
          payload: dto,
          files: photo ? [photo] : undefined,
        });
        return localUpdated;
      }
      throw e;
    }
  },
  remove: async (id: string) => {
    try {
      await http.delete(`patients/${id}`);
      const cached = (await offlineStorage.getPatients()) || [];
      await offlineStorage.savePatients(cached.filter(p => p.id !== id));
    } catch (e: any) {
      if (e?.status === 0 || !e?.status) {
        const cached = (await offlineStorage.getPatients()) || [];
        await offlineStorage.savePatients(cached.filter(p => p.id !== id));
        return;
      }
      throw e;
    }
  },
  uploadPhoto: (id: string, file: LocalFile) =>
    http.upload<{ photoUrl: string }>(`patients/${id}/photo`, file),
};

export interface RecordInput<C extends string> {
  patientId: string;
  title: string;
  description: string | null;
  /** complaint: type, diagnosis/treatment: category */
  kind: C;
  date: string;
}

export interface RecordUpdateInput<C extends string> {
  title: string;
  description: string | null;
  kind: C;
  date?: string;
}

export const complaintsApi = {
  list: (patientId: string, type?: string, search?: string) =>
    http.get<Complaint[]>('complaints', { patientId, type, search }),
  get: (id: string) => http.get<Complaint>(`complaints/${id}`),
  create: (dto: RecordInput<ComplaintType>) =>
    http.post<Complaint>('complaints', {
      patientId: dto.patientId,
      title: dto.title,
      description: dto.description,
      type: dto.kind,
    }),
  update: (id: string, dto: RecordUpdateInput<ComplaintType>) =>
    http.put<Complaint>(`complaints/${id}`, {
      title: dto.title,
      description: dto.description,
      type: dto.kind,
    }),
  remove: (id: string) => http.delete(`complaints/${id}`),
  upload: (id: string, file: LocalFile) =>
    http.upload<FileItem>(`complaints/${id}/attachments`, file, {
      type: file.kind === 'audio' ? 'VoiceRecording' : 'Image',
    }),
  removeFile: (id: string, fileId: string) =>
    http.delete(`complaints/${id}/attachments/${fileId}`),
};

export const diagnosesApi = {
  list: (patientId: string, category?: string, search?: string) =>
    http.get<Diagnosis[]>('diagnoses', { patientId, category, search }),
  get: (id: string) => http.get<Diagnosis>(`diagnoses/${id}`),
  create: (dto: RecordInput<DiagnosisCategory>) =>
    http.post<Diagnosis>('diagnoses', {
      patientId: dto.patientId,
      title: dto.title,
      description: dto.description,
      category: dto.kind,
      date: dto.date,
    }),
  update: (id: string, dto: RecordUpdateInput<DiagnosisCategory>) =>
    http.put<Diagnosis>(`diagnoses/${id}`, {
      title: dto.title,
      description: dto.description,
      category: dto.kind,
      date: dto.date,
    }),
  remove: (id: string) => http.delete(`diagnoses/${id}`),
  upload: (id: string, file: LocalFile) =>
    http.upload<FileItem>(`diagnoses/${id}/documents`, file),
  removeFile: (id: string, fileId: string) =>
    http.delete(`diagnoses/${id}/documents/${fileId}`),
};

export const treatmentsApi = {
  list: (patientId: string, category?: string, search?: string) =>
    http.get<Treatment[]>('treatments', { patientId, category, search }),
  get: (id: string) => http.get<Treatment>(`treatments/${id}`),
  create: (dto: RecordInput<TreatmentCategory>) =>
    http.post<Treatment>('treatments', {
      patientId: dto.patientId,
      title: dto.title,
      description: dto.description,
      category: dto.kind,
      date: dto.date,
    }),
  update: (id: string, dto: RecordUpdateInput<TreatmentCategory>) =>
    http.put<Treatment>(`treatments/${id}`, {
      title: dto.title,
      description: dto.description,
      category: dto.kind,
      date: dto.date,
    }),
  remove: (id: string) => http.delete(`treatments/${id}`),
  upload: (id: string, file: LocalFile) =>
    http.upload<FileItem>(`treatments/${id}/documents`, file),
  removeFile: (id: string, fileId: string) =>
    http.delete(`treatments/${id}/documents/${fileId}`),
};

export const appointmentsApi = {
  list: (patientId: string) =>
    appointmentsApi.range(patientId, '2000-01-01', '2099-12-31'),
  range: async (patientId: string, startDate: string, endDate: string): Promise<Appointment[]> => {
    try {
      const remote = await http.get<Appointment[]>('appointments', {
        patientId,
        startDate,
        endDate,
      });
      const queue = await offlineStorage.getQueue();
      const pendingIds = new Set(
        queue
          .filter(
            q =>
              q.type === 'create_appointment' &&
              q.payload?.patientId === patientId,
          )
          .map(q => q.recordId)
          .filter(Boolean),
      );

      const cached = await offlineStorage.getAppointments(patientId);
      const localPending = (cached || []).filter(
        a => a.id.startsWith('local_app_') && pendingIds.has(a.id),
      );

      const remoteKeys = new Set(
        remote.map(a => `${a.title} ${a.dateTime}`.toLowerCase()),
      );
      const unSyncedLocal = localPending.filter(
        a => !remoteKeys.has(`${a.title} ${a.dateTime}`.toLowerCase()),
      );

      const seenIds = new Set<string>();
      const merged: Appointment[] = [];
      for (const a of [...unSyncedLocal, ...remote]) {
        if (!seenIds.has(a.id)) {
          seenIds.add(a.id);
          merged.push(a);
        }
      }

      await offlineStorage.saveAppointments(patientId, merged);
      return merged;
    } catch (e: any) {
      if (e?.status === 0 || !e?.status) {
        const cached = await offlineStorage.getAppointments(patientId);
        if (cached) {
          return cached;
        }
      }
      throw e;
    }
  },
  create: async (dto: AppointmentInput): Promise<Appointment> => {
    try {
      const created = await http.post<Appointment>('appointments', dto);
      const cached = (await offlineStorage.getAppointments(dto.patientId)) || [];
      await offlineStorage.saveAppointments(dto.patientId, [created, ...cached]);
      return created;
    } catch (e: any) {
      if (e?.status === 0 || !e?.status) {
        const localApp: Appointment = {
          id: `local_app_${Date.now()}`,
          patientId: dto.patientId,
          patientName: null,
          doctorId: null,
          doctorName: null,
          doctorSpecialty: null,
          title: dto.title,
          location: dto.location,
          dateTime: dto.dateTime,
          notes: dto.notes,
          type: dto.type,
          createdAt: new Date().toISOString(),
        };
        const cached = (await offlineStorage.getAppointments(dto.patientId)) || [];
        await offlineStorage.saveAppointments(dto.patientId, [localApp, ...cached]);
        await offlineStorage.enqueue({
          type: 'create_appointment',
          recordId: localApp.id,
          payload: dto,
        });
        return localApp;
      }
      throw e;
    }
  },
  update: async (
    id: string,
    dto: Omit<AppointmentInput, 'patientId'> & { doctorId?: string | null },
  ): Promise<Appointment | undefined> => {
    try {
      return await http.put<Appointment>(`appointments/${id}`, dto);
    } catch (e: any) {
      if (e?.status === 0 || !e?.status) {
        await offlineStorage.enqueue({
          type: 'update_appointment',
          recordId: id,
          payload: dto,
        });
        return undefined;
      }
      throw e;
    }
  },
  remove: (id: string) => http.delete(`appointments/${id}`),
};

