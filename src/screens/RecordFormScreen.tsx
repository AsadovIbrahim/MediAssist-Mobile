import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Camera, FileText, FileUp, Image as ImageIcon, Mic, X, type LucideIcon } from 'lucide-react-native';
import { fileUrl } from '../api/client';
import type { FileItem, LocalFile } from '../api/types';
import { DatePickerModal } from '../components/DatePickerModal';
import { LocalFileRow, RecorderModal } from '../components/media';
import { Button, Field, KeyboardScrollView, Loading, ScreenHeader } from '../components/ui';
import { usePatient } from '../context/PatientContext';
import { RECORDS, type UploadSource } from '../features/records';
import type { RootScreenProps } from '../navigation/types';
import { colors, tints } from '../theme';
import { formatDateLong, formatSize, toApiDate } from '../utils/format';
import { isImageFile, pickDocuments, pickImages, takePhoto } from '../utils/media';

export function RecordFormScreen({ navigation, route }: RootScreenProps<'RecordForm'>) {
  const { kind, id: recordId } = route.params;
  const isEditing = !!recordId;
  const cfg = RECORDS[kind];
  const { patient, refresh: refreshPatients } = usePatient();

  const [selectedKind, setSelectedKind] = useState(cfg.defaultKind);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [existingFiles, setExistingFiles] = useState<FileItem[]>([]);
  const [loadingRecord, setLoadingRecord] = useState(isEditing);
  const [showRecorder, setShowRecorder] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!recordId) {
      return;
    }
    (async () => {
      try {
        const item = await cfg.api.get(recordId);
        setDescription(item.description ?? '');
        if (item.date) {
          setDate(new Date(item.date));
        }
        if (item.kind) {
          setSelectedKind(item.kind);
        }
        setExistingFiles(item.files ?? []);
      } catch (e) {
        Alert.alert('Xəta', (e as Error).message);
      } finally {
        setLoadingRecord(false);
      }
    })();
  }, [recordId]);

  const onRemoveExistingFile = (file: FileItem) => {
    Alert.alert('Fayl silinsin?', file.fileName, [
      { text: 'Ləğv et', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          if (!recordId) {
            return;
          }
          try {
            await cfg.api.removeFile(recordId, file.id);
            setExistingFiles(prev => prev.filter(f => f.id !== file.id));
          } catch (e) {
            Alert.alert('Xəta', (e as Error).message);
          }
        },
      },
    ]);
  };

  const appendFiles = (incoming: LocalFile[]) => {
    if (!incoming.length) {
      return;
    }
    setFiles(prev => [...prev, ...incoming]);
    if (incoming.some(f => f.kind === 'audio')) {
      setSelectedKind('Voice');
    } else if (incoming.some(f => f.kind === 'image')) {
      setSelectedKind('Image');
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
    if (!description.trim() && files.length === 0 && existingFiles.length === 0) {
      Alert.alert('Diqqət', 'Zəhmət olmasa təsvir yazın və ya fayl əlavə edin.');
      return;
    }

    const firstLine = description.trim().split('\n')[0].trim();
    const finalTitle =
      firstLine.length > 0
        ? firstLine.length > 50
          ? `${firstLine.slice(0, 47)}...`
          : firstLine
        : files.some(f => f.kind === 'audio')
        ? `${cfg.singular} (Səs qeydi)`
        : files.length > 0 || existingFiles.length > 0
        ? `${cfg.singular} (Fayllı)`
        : `${cfg.singular} qeydi`;

    setSaving(true);
    try {
      let targetId = isEditing && recordId ? recordId : '';

      if (targetId) {
        await cfg.api.update(targetId, {
          patientId: patient.id,
          title: finalTitle,
          description: description.trim() || null,
          kind: selectedKind,
          date: toApiDate(date),
        });
      } else {
        const created = await cfg.api.create({
          patientId: patient.id,
          title: finalTitle,
          description: description.trim() || null,
          kind: selectedKind,
          date: toApiDate(date),
        });
        targetId = created.id;
      }

      const failed: string[] = [];
      for (const file of files) {
        try {
          await cfg.api.upload(targetId, file);
        } catch {
          failed.push(file.name);
        }
      }

      await refreshPatients();

      if (failed.length) {
        Alert.alert(
          'Qismən saxlanıldı',
          `Qeyd saxlanıldı, lakin bəzi fayllar yüklənmədi: ${failed.join(', ')}`,
        );
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Xəta', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingRecord) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <ScreenHeader title={cfg.editTitle} />
        <Loading />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <ScreenHeader title={isEditing ? cfg.editTitle : cfg.newTitle} />

      <KeyboardScrollView className="flex-1 px-4 pt-2">
        {cfg.hasDate && (
          <View className="mb-5">
            <Text className="mb-2 text-[16px] font-bold text-ink">Tarix</Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              hitSlop={10}
              className="flex-row items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5">
              <Text className="text-[16px] font-semibold text-ink">{formatDateLong(date)}</Text>
              <Calendar size={22} color={colors.textMuted} />
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

        <Text className="mb-3 text-[16px] font-bold text-ink">Fayllar əlavə et</Text>
        <View className="mb-5 flex-row gap-2.5">
          {cfg.sources.map(src => (
            <UploadTile key={src} source={src} onPress={() => handleSource(src)} />
          ))}
        </View>

        {/* Existing uploaded files (in edit mode) */}
        {existingFiles.length > 0 && (
          <View className="mb-4">
            <Text className="mb-2 text-xs font-semibold uppercase text-ink-muted">
              Mövcud fayllar ({existingFiles.length})
            </Text>
            <View className="rounded-2xl border border-line bg-surface px-3.5">
              {existingFiles.map((file, idx) => (
                <View
                  key={file.id}
                  className={`flex-row items-center justify-between py-3 ${
                    idx !== existingFiles.length - 1 ? 'border-b border-line' : ''
                  }`}>
                  <View className="mr-3 flex-1 flex-row items-center">
                    {isImageFile(file) ? (
                      <Image
                        source={{ uri: fileUrl(file.filePath) }}
                        className="h-10 w-10 rounded-lg bg-field"
                      />
                    ) : (
                      <View className="h-10 w-10 items-center justify-center rounded-lg bg-field">
                        <FileText size={20} color={colors.primary} />
                      </View>
                    )}
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-medium text-ink" numberOfLines={1}>
                        {file.fileName}
                      </Text>
                      <Text className="text-xs text-ink-muted">{formatSize(file.fileSize)}</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => onRemoveExistingFile(file)}
                    hitSlop={8}
                    className="h-8 w-8 items-center justify-center rounded-full active:bg-field">
                    <X size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Newly selected files waiting for upload */}
        {files.length > 0 && (
          <View className="mb-4">
            {existingFiles.length > 0 && (
              <Text className="mb-2 text-xs font-semibold uppercase text-ink-muted">
                Yeni əlavə edilən fayllar ({files.length})
              </Text>
            )}
            <View className="rounded-2xl border border-line bg-surface px-3.5">
              {files.map((f, idx) => (
                <LocalFileRow
                  key={`${f.uri}-${idx}`}
                  file={f}
                  last={idx === files.length - 1}
                  onRemove={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                />
              ))}
            </View>
          </View>
        )}

        <View className="mt-2 mb-8">
          <Button
            label="Yadda saxla"
            size="lg"
            loading={saving}
            onPress={onSave}
          />
        </View>
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
      className="flex-1 items-center justify-center rounded-2xl py-4.5 active:opacity-80">
      <Icon size={28} color={meta.fg} strokeWidth={2.2} />
      <Text style={{ color: meta.fg }} className="mt-2.5 text-center text-[13px] font-bold">
        {meta.label}
      </Text>
    </Pressable>
  );
}

