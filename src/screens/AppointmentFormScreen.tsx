import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'lucide-react-native';
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
import { usePatient } from '../context/PatientContext';
import type { RootScreenProps } from '../navigation/types';
import { colors } from '../theme';
import { formatDateLong, parseDate, toApiDate } from '../utils/format';

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
  const { patient, refresh: refreshPatients } = usePatient();
  const initialDate = route.params?.date ? parseDate(route.params.date) : new Date();

  const [type, setType] = useState<AppointmentType>('DoctorVisit');
  const [title, setTitle] = useState('Həkim müayinəsi');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const onTypeChange = (next: AppointmentType) => {
    setType(next);
    if (title === 'Həkim müayinəsi' || title === 'Qan analizi' || !title.trim()) {
      setTitle(next === 'LabTest' ? 'Qan analizi' : 'Həkim müayinəsi');
    }
  };

  const onSave = async () => {
    if (!patient) {
      Alert.alert('Diqqət', 'Əvvəlcə pasiyent seçin.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Diqqət', 'Başlıq daxil edin.');
      return;
    }
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!m) {
      Alert.alert('Diqqət', 'Saatı SS:DD formatında daxil edin (məs: 10:00).');
      return;
    }
    const dt = new Date(date);
    dt.setHours(Math.min(23, Number(m[1])), Math.min(59, Number(m[2])), 0, 0);

    setSaving(true);
    try {
      await appointmentsApi.create({
        patientId: patient.id,
        title: title.trim(),
        location: location.trim() || null,
        dateTime: toApiDate(dt),
        notes: notes.trim() || null,
        type,
      });
      await refreshPatients();
      navigation.goBack();
    } catch (e) {
      Alert.alert('Xəta', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <ScreenHeader
        title="Yeni müayinə"
        right={<Button label="Saxla" size="sm" loading={saving} onPress={onSave} />}
      />

      <KeyboardScrollView className="flex-1 px-4 pt-2">
        <Segmented options={TYPES} value={type} onChange={onTypeChange} />

        <Field
          label="Başlıq"
          placeholder="Məs: Həkim müayinəsi, Qan analizi"
          value={title}
          onChangeText={setTitle}
        />

        <Field
          label="İxtisas / Klinika"
          placeholder="Məs: Nevroloq, Lab klinika"
          value={location}
          onChangeText={setLocation}
        />

        <View className="mb-4">
          <Text className="mb-2 text-[15px] font-semibold text-ink">Tarix</Text>
          <Pressable
            onPress={() => setShowPicker(true)}
            className="flex-row items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-3">
            <Text className="text-[15px] text-ink">{formatDateLong(date)}</Text>
            <Calendar size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <Field
          label="Saat"
          placeholder="10:00"
          value={time}
          onChangeText={setTime}
        />

        <View className="-mt-2 mb-4 flex-row flex-wrap gap-2">
          {QUICK_TIMES.map(t => (
            <Pressable
              key={t}
              onPress={() => setTime(t)}
              className={`rounded-lg px-3 py-1.5 ${
                time === t ? 'bg-primary' : 'bg-field'
              }`}>
              <Text className={`text-xs font-medium ${time === t ? 'text-white' : 'text-ink-muted'}`}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field
          label="Qeyd"
          placeholder="Əlavə qeydlər, xatırlatma..."
          multiline
          value={notes}
          onChangeText={setNotes}
        />
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

