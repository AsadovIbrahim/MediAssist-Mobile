// Types mirroring the MediAssist backend DTOs (MediAssist.Application/DTOs).

export interface AuthResponse {
  token: string;
  email: string;
  fullName: string;
  doctorId: string | null;
  roles: string[];
  expiration: string;
}

export interface RegisterDoctorRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  specialty?: string | null;
  phone: string;
  workplace?: string | null;
}

export interface RegisterOtpResponse {
  requiresOtp: boolean;
  email: string;
  phone: string;
  message: string;
  expiresInSeconds: number;
}

export interface MessageResponse {
  message: string;
}

export interface Patient {
  id: string;
  doctorId: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string | null;
  age: number | null;
  photoUrl: string | null;
  note: string | null;
  createdAt: string;
  complaintCount: number;
  diagnosisCount: number;
  treatmentCount: number;
  appointmentCount: number;
}

export interface PatientInput {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string | null;
  note: string | null;
}

export interface PatientDashboard {
  patientId: string;
  patientName: string;
  age: number | null;
  phone: string | null;
  photoUrl: string | null;
  complaintCount: number;
  diagnosisCount: number;
  treatmentCount: number;
  aiDocumentCount: number;
  appointmentCount: number;
  upcomingAppointments: Appointment[];
}

/** Shared shape of complaint attachments / diagnosis & treatment documents. */
export interface FileItem {
  id: string;
  fileName: string;
  filePath: string;
  /** Complaint: Image | VoiceRecording. Documents: Pdf | Doc | Image | Other */
  type: string;
  fileSize: number;
}

export type ComplaintType = 'Text' | 'Image' | 'Voice';
export type DiagnosisCategory = 'Document' | 'Image' | 'Note';
export type TreatmentCategory = 'Prescription' | 'Plan' | 'Note';
export type AppointmentType = 'DoctorVisit' | 'LabTest' | 'Other';

export interface Complaint {
  id: string;
  patientId: string;
  title: string;
  description: string | null;
  type: ComplaintType;
  createdAt: string;
  attachments: FileItem[];
}

export interface Diagnosis {
  id: string;
  patientId: string;
  title: string;
  description: string | null;
  category: DiagnosisCategory;
  date: string;
  createdAt: string;
  documents: FileItem[];
}

export interface Treatment {
  id: string;
  patientId: string;
  title: string;
  description: string | null;
  category: TreatmentCategory;
  date: string;
  createdAt: string;
  documents: FileItem[];
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string | null;
  doctorId: string | null;
  doctorName: string | null;
  doctorSpecialty: string | null;
  title: string;
  location: string | null;
  dateTime: string;
  notes: string | null;
  type: AppointmentType;
  createdAt: string;
}

export interface AppointmentInput {
  patientId: string;
  title: string;
  location: string | null;
  dateTime: string;
  notes: string | null;
  type: AppointmentType;
}

export interface CurrentUser {
  userId: string;
  doctorId: string;
  fullName: string | null;
  email: string | null;
  roles: string[];
}

/** A local file chosen on the device, waiting to be uploaded. */
export interface LocalFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
  /** Duration in ms (voice recordings only). */
  durationMs?: number;
  kind: 'image' | 'audio' | 'document';
}

