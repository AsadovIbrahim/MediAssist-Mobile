import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Trash2 } from 'lucide-react-native';
import { appointmentsApi } from '../api/services';
import type { AppointmentType } from '../api/types';
import { DatePickerModal } from '../components/DatePickerModal';
import {
  Button,
  Field,
  KeyboardScrollView,
  ScreenHeader,
  Segmented,
  type ChipOption,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';
import type { RootScreenProps } from '../navigation/types';
import { formatDateLong, formatTime, parseDate, toApiDate } from '../utils/format';
import {
  cancelAppointmentNotification,
  requestNotificationPermission,
  scheduleAppointmentNotification,
} from '../utils/notifications';

const TYPES: ChipOption<AppointmentType>[] = [
  { value: 'DoctorVisit', label: 'Həkim müayinəsi' },
  { value: 'LabTest', label: 'Analiz / Lab' },
  { value: 'Other', label: 'Digər' },
];

const QUICK_TIMES = ['09:00', '10:00', '11:30', '14:00', '15:30', '17:00'];

export function AppointmentFormScreen({
  navigation,
  route,
}: RootScreenProps<'AppointmentForm'>) {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const { patient, refresh: refreshPatients } = usePatient();
  const editing = route.params?.appointment;
  const isEditing = !!editing;

  const types: ChipOption<AppointmentType>[] = [
    { value: 'DoctorVisit', label: t('appointment.doctorVisit') },
    { value: 'LabTest', label: t('appointment.labTest') },
    { value: 'Other', label: t('appointment.other') },
  ];

  const [type, setType] = useState<AppointmentType>(editing?.type ?? 'DoctorVisit');
  const [title, setTitle] = useState(editing?.title ?? t('appointment.doctorVisit'));
  const [location, setLocation] = useState(editing?.location ?? '');
  const [date, setDate] = useState(() => {
    if (editing?.dateTime) {
      return parseDate(editing.dateTime);
    }
    return route.params?.date ? parseDate(route.params.date) : new Date();
  });
  const [time, setTime] = useState(() => {
    if (editing?.dateTime) {
      return formatTime(editing.dateTime);
    }
    return '10:00';
  });
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const onTypeChange = (next: AppointmentType) => {
    setType(next);
    if (
      title === t('appointment.doctorVisit') ||
      title === t('appointment.labTest') ||
      !title.trim()
    ) {
      setTitle(next === 'LabTest' ? t('appointment.labTest') : t('appointment.doctorVisit'));
    }
  };

  const onDelete = () => {
    if (!editing) return;
    Alert.alert(
      t('common.delete') || 'Sil',
      'Bu görüş və ya müayinəni silmək istədiyinizə əminsiniz?',
      [
        { text: t('common.cancel') || 'Ləğv et', style: 'cancel' },
        {
          text: t('common.delete') || 'Sil',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await cancelAppointmentNotification(editing.id);
              await appointmentsApi.remove(editing.id);
              await refreshPatients();
              navigation.goBack();
            } catch (err: any) {
              Alert.alert(t('common.error'), err?.message || 'Silinmə zamanı xəta baş verdi');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const onSave = async () => {
    if (!isEditing && !patient) {
      Alert.alert(t('common.attention'), t('form.needPatient'));
      return;
    }
    if (!title.trim()) {
      Alert.alert(t('common.attention'), t('appointment.needTitle'));
      return;
    }
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!m) {
      Alert.alert(t('common.attention'), t('appointment.invalidTime'));
      return;
    }
    const dt = new Date(date);
    dt.setHours(Math.min(23, Number(m[1])), Math.min(59, Number(m[2])), 0, 0);
    const isoDateTime = toApiDate(dt);

    setSaving(true);
    try {
      if (isEditing && editing) {
        const resolvedDoctorId = editing.doctorId || user?.doctorId || null;
        await appointmentsApi.update(editing.id, {
          title: title.trim(),
          location: location.trim() || null,
          dateTime: isoDateTime,
          notes: notes.trim() || null,
          type,
          doctorId: resolvedDoctorId,
        });

        // Reschedule notification
        try {
          await cancelAppointmentNotification(editing.id);
          await scheduleAppointmentNotification({
            id: editing.id,
            patientId: patient?.id || editing.patientId,
            title: title.trim(),
            patientName:
              patient ? `${patient.firstName} ${patient.lastName}` : (editing.patientName || null),
            dateTime: isoDateTime,
          });
        } catch {}
      } else if (patient) {
        const created = await appointmentsApi.create({
          patientId: patient.id,
          title: title.trim(),
          location: location.trim() || null,
          dateTime: isoDateTime,
          notes: notes.trim() || null,
          type,
        });

        // Schedule notification reminder for this appointment
        if (created?.id) {
          try {
            await scheduleAppointmentNotification({
              id: created.id,
              patientId: patient.id,
              title: created.title,
              patientName: `${patient.firstName} ${patient.lastName}`.trim(),
              dateTime: created.dateTime,
            });
          } catch {}
        }
      }

      await refreshPatients();
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.background }} className="flex-1">
      <ScreenHeader
        title={isEditing ? t('appointment.editAppointment') : t('appointment.newAppointment')}
        right={
          isEditing ? (
            <Pressable
              onPress={onDelete}
              hitSlop={10}
              disabled={deleting || saving}
              style={{ backgroundColor: colors.dangerSoft }}
              className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
              <Trash2 size={19} color={colors.danger} />
            </Pressable>
          ) : undefined
        }
      />

      <KeyboardScrollView className="flex-1 px-4 pt-2">
        <Segmented options={types} value={type} onChange={onTypeChange} />

        <Field
          label={t('appointment.title')}
          placeholder={t('appointment.titlePlh')}
          value={title}
          onChangeText={setTitle}
        />

        <Field
          label={t('appointment.location')}
          placeholder={t('appointment.locationPlh')}
          value={location}
          onChangeText={setLocation}
        />

        <View className="mb-5">
          <Text style={{ color: colors.text }} className="mb-2 text-[16px] font-bold">{t('form.date')}</Text>
          <Pressable
            onPress={() => setShowPicker(true)}
            hitSlop={10}
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="flex-row items-center justify-between rounded-2xl border px-4 py-3.5">
            <Text style={{ color: colors.text }} className="text-[16px] font-semibold">{formatDateLong(date, language)}</Text>
            <Calendar size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <Field
          label={t('appointment.time')}
          placeholder="10:00"
          value={time}
          onChangeText={setTime}
        />

        <View className="-mt-2 mb-5 flex-row flex-wrap gap-2.5">
          {QUICK_TIMES.map(tm => (
            <Pressable
              key={tm}
              onPress={() => setTime(tm)}
              hitSlop={6}
              style={{ backgroundColor: time === tm ? colors.primary : colors.field }}
              className="rounded-xl px-4 py-2.5">
              <Text style={{ color: time === tm ? '#ffffff' : colors.text }} className="text-[14px] font-bold">
                {tm}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field
          label={t('appointment.notes')}
          placeholder={t('appointment.notesPlh')}
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        <View className="mt-2 mb-8">
          <Button
            label={t('common.save')}
            size="lg"
            loading={saving}
            disabled={deleting}
            onPress={onSave}
          />
        </View>
      </KeyboardScrollView>

      <DatePickerModal
        visible={showPicker}
        value={date}
        onClose={() => setShowPicker(false)}
        onChange={setDate}
      />
    </SafeAreaView>
  );
}

