import { http } from './client';
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
  list: (search?: string) => http.get<Patient[]>('patients', { search }),
  get: (id: string) => http.get<Patient>(`patients/${id}`),
  dashboard: (id: string) => http.get<PatientDashboard>(`patients/${id}/dashboard`),
  create: (dto: PatientInput) => http.post<Patient>('patients', dto),
  update: (id: string, dto: PatientInput) => http.put<Patient>(`patients/${id}`, dto),
  remove: (id: string) => http.delete(`patients/${id}`),
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
  range: (patientId: string, startDate: string, endDate: string) =>
    http.get<Appointment[]>('appointments', { patientId, startDate, endDate }),
  create: (dto: AppointmentInput) => http.post<Appointment>('appointments', dto),
  update: (id: string, dto: Omit<AppointmentInput, 'patientId'>) =>
    http.put<Appointment>(`appointments/${id}`, dto),
  remove: (id: string) => http.delete(`appointments/${id}`),
};

