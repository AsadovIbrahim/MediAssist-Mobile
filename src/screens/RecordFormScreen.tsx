import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Camera, FileUp, Image as ImageIcon, Mic, type LucideIcon } from 'lucide-react-native';
import type { LocalFile } from '../api/types';
import { DatePickerModal } from '../components/DatePickerModal';
import { LocalFileRow, RecorderModal } from '../components/media';
import { Button, Field, KeyboardScrollView, ScreenHeader, Segmented } from '../components/ui';
import { usePatient } from '../context/PatientContext';
import { RECORDS, type UploadSource } from '../features/records';
import type { RootScreenProps } from '../navigation/types';
import { colors, tints } from '../theme';
import { formatDateLong, toApiDate } from '../utils/format';
import { pickDocuments, pickImages, takePhoto } from '../utils/media';

export function RecordFormScreen({ navigation, route }: RootScreenProps<'RecordForm'>) {
  const { kind } = route.params;
  const cfg = RECORDS[kind];
  const { patient, refresh: refreshPatients } = usePatient();

  const [selectedKind, setSelectedKind] = useState(cfg.defaultKind);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [showRecorder, setShowRecorder] = useState(false);
  const [saving, setSaving] = useState(false);

  const appendFiles = (incoming: LocalFile[]) => {
    if (!incoming.length) {
      return;
    }
    setFiles(prev => [...prev, ...incoming]);
    // Auto-select matching type on complaint if user hasn't changed from Text
    if (kind === 'complaint' && selectedKind === 'Text') {
      if (incoming.some(f => f.kind === 'audio')) {
        setSelectedKind('Voice');
      } else if (incoming.some(f => f.kind === 'image')) {
        setSelectedKind('Image');
      }
    }
  };

  const handleSource = async (src: UploadSource) => {
    if (src === 'gallery') {
      appendFiles(await pickImages());
    } else if (src === 'camera') {
      appendFiles(await takePhoto());
    } else if (src === 'voice') {
      setShowRecorder(true);
    } else if (src === 'document') {
      appendFiles(await pickDocuments());
    }
  };

  const onSave = async () => {
    if (!patient) {
      Alert.alert('Diqqət', 'Əvvəlcə pasiyent seçin və ya yaradın.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Diqqət', 'Başlıq daxil edin.');
      return;
    }
    setSaving(true);
    try {
      const created = await cfg.api.create({
        patientId: patient.id,
        title: title.trim(),
        description: description.trim() || null,
        kind: selectedKind,
        date: toApiDate(date),
      });

      const failed: string[] = [];
      for (const file of files) {
        try {
          await cfg.api.upload(created.id, file);
        } catch {
          failed.push(file.name);
        }
      }

      await refreshPatients();

      if (failed.length) {
        Alert.alert(
          'Qismən saxlanıldı',
          `Qeyd yaradıldı, lakin bəzi fayllar yüklənmədi: ${failed.join(', ')}`,
        );
      }
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
        title={cfg.newTitle}
        right={<Button label="Saxla" size="sm" loading={saving} onPress={onSave} />}
      />

      <KeyboardScrollView className="flex-1 px-4 pt-2">
        <Segmented options={cfg.kinds} value={selectedKind} onChange={setSelectedKind} />

        <Field
          label="Başlıq"
          placeholder={cfg.titlePlaceholder}
          value={title}
          onChangeText={setTitle}
        />

        {cfg.hasDate && (
          <View className="mb-4">
            <Text className="mb-2 text-[15px] font-semibold text-ink">Tarix</Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              className="flex-row items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-3">
              <Text className="text-[15px] text-ink">{formatDateLong(date)}</Text>
              <Calendar size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        )}

        <Field
          label={cfg.descriptionLabel}
          placeholder={cfg.descriptionPlaceholder}
          multiline
          counter={500}
          value={description}
          onChangeText={setDescription}
        />

        <Text className="mb-2.5 text-[15px] font-semibold text-ink">Fayllar əlavə et</Text>
        <View className="mb-4 flex-row gap-2.5">
          {cfg.sources.map(src => (
            <UploadTile key={src} source={src} onPress={() => handleSource(src)} />
          ))}
        </View>

        {files.length > 0 && (
          <View className="mb-8 rounded-2xl border border-line bg-surface px-3.5">
            {files.map((f, idx) => (
              <LocalFileRow
                key={`${f.uri}-${idx}`}
                file={f}
                last={idx === files.length - 1}
                onRemove={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
              />
            ))}
          </View>
        )}
      </KeyboardScrollView>

      <RecorderModal
        visible={showRecorder}
        onClose={() => setShowRecorder(false)}
        onRecorded={file => appendFiles([file])}
      />

      <DatePickerModal
        visible={showDatePicker}
        value={date}
        onClose={() => setShowDatePicker(false)}
        onChange={setDate}
      />
    </SafeAreaView>
  );
}

const SOURCE_META: Record<
  UploadSource,
  { label: string; icon: LucideIcon; bg: string; fg: string }
> = {
  gallery: {
    label: 'Şəkil əlavə et',
    icon: ImageIcon,
    bg: tints.blue.bg,
    fg: tints.blue.fg,
  },
  camera: {
    label: 'Kamera',
    icon: Camera,
    bg: tints.blue.bg,
    fg: tints.blue.fg,
  },
  voice: {
    label: 'Səs qeydi',
    icon: Mic,
    bg: tints.red.bg,
    fg: tints.red.fg,
  },
  document: {
    label: 'Sənəd seç',
    icon: FileUp,
    bg: tints.red.bg,
    fg: tints.red.fg,
  },
};

function UploadTile({ source, onPress }: { source: UploadSource; onPress: () => void }) {
  const meta = SOURCE_META[source];
  const Icon = meta.icon;
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: meta.bg }}
      className="flex-1 items-center justify-center rounded-2xl py-4 active:opacity-80">
      <Icon size={24} color={meta.fg} strokeWidth={2} />
      <Text style={{ color: meta.fg }} className="mt-2 text-xs font-semibold">
        {meta.label}
      </Text>
    </Pressable>
  );
}

