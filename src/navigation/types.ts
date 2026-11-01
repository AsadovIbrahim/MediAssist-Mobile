import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Appointment } from '../api/types';
import type { RecordKind } from '../features/records';

export type TabParamList = {
  Home: undefined;
  Documents: undefined;
  Search: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  OtpVerification: {
    email: string;
    phone: string;
    expiresInSeconds?: number;
  };
  ForgotPassword: { initialEmail?: string } | undefined;
  ResetPasswordOtp: { email: string };
  ResetPasswordNew: { email: string; otpCode: string };
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  PatientDashboard: undefined;
  RecordList: { kind: RecordKind };
  RecordForm: { kind: RecordKind; id?: string };
  RecordDetail: { kind: RecordKind; id: string };
  Calendar: undefined;
  AppointmentForm: { date?: string; appointment?: Appointment } | undefined;
  Ai: undefined;
  Patients: undefined;
  PatientForm: { id?: string } | undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

