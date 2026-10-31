import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type { Appointment } from '../api/types';
import { formatTime, parseDate } from './format';

const { LocalNotificationModule } = NativeModules;

/** Hash string (e.g. UUID) into a stable positive 31-bit integer. */
function hashId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Request notification permission on Android 13+ (API 33+). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Görüş xatırlatmaları',
          message:
            'Təqvimdəki görüşlərin vaxtı çatanda sizə xatırlatma göndərilməsi üçün bildirişlərə icazə verin.',
          buttonPositive: 'İcazə ver',
          buttonNegative: 'Ləğv et',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }
  return true;
}

/** Schedule a local system notification for an appointment. */
export async function scheduleAppointmentNotification(appointment: {
  id: string;
  title: string;
  patientName?: string | null;
  dateTime: string;
}): Promise<void> {
  if (!LocalNotificationModule?.scheduleNotification) {
    return;
  }

  const apptDate = parseDate(appointment.dateTime);
  const now = Date.now();
  const targetTime = apptDate.getTime();

  // If already in the past, do not schedule
  if (targetTime <= now) {
    return;
  }

  const id = hashId(appointment.id);
  const patientText = appointment.patientName ? `${appointment.patientName}` : 'Pasiyent';
  const timeText = formatTime(apptDate);
  const title = `🔔 Görüş xatırlatması: ${patientText}`;
  const message = `Saat ${timeText} - ${appointment.title}`;

  try {
    // Schedule at the exact appointment time (or 15 mins before if > 15 mins away)
    const fifteenMinBefore = targetTime - 15 * 60 * 1000;
    const triggerTime = fifteenMinBefore > now ? fifteenMinBefore : targetTime;

    const notifMessage =
      triggerTime === fifteenMinBefore
        ? `15 dəqiqə sonra (Saat ${timeText}) - ${appointment.title}`
        : message;

    await LocalNotificationModule.scheduleNotification(id, title, notifMessage, triggerTime);
  } catch (e) {
    console.warn('Failed to schedule notification:', e);
  }
}

/** Cancel a previously scheduled notification. */
export async function cancelAppointmentNotification(appointmentId: string): Promise<void> {
  if (!LocalNotificationModule?.cancelNotification) {
    return;
  }
  try {
    const id = hashId(appointmentId);
    await LocalNotificationModule.cancelNotification(id);
  } catch (e) {
    console.warn('Failed to cancel notification:', e);
  }
}

/** Sync all upcoming appointments into Android alarms. */
export async function syncUpcomingAppointments(appointments: Appointment[]): Promise<void> {
  if (!LocalNotificationModule?.scheduleNotification || !appointments.length) {
    return;
  }

  await requestNotificationPermission();

  const now = Date.now();
  for (const appt of appointments) {
    const target = parseDate(appt.dateTime).getTime();
    if (target > now) {
      await scheduleAppointmentNotification(appt);
    }
  }
}

