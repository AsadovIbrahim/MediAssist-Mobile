import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
  RecordList: { kind: RecordKind };
  RecordForm: { kind: RecordKind };
  RecordDetail: { kind: RecordKind; id: string };
  Calendar: undefined;
  AppointmentForm: { date?: string } | undefined;
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

