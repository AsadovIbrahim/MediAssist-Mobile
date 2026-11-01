import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExternalLink, FileText, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { fileUrl } from '../api/client';
import type { FileItem } from '../api/types';
import { ImageViewer, openRemoteFile, VoicePlayer } from '../components/media';
import { Button, Card, ErrorBanner, IconTile, Loading, ScreenHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';
import { getRecordConfig, localizeRecordTitle, RECORDS, recordVisual, splitFiles } from '../features/records';
import type { RootScreenProps } from '../navigation/types';
import { formatDate, formatSize } from '../utils/format';
import { useFocusData } from '../utils/hooks';
import { docLabel, pickDocuments, pickImages } from '../utils/media';

export function RecordDetailScreen({ navigation, route }: RootScreenProps<'RecordDetail'>) {
  const { kind, id } = route.params;
  const { language, t } = useLanguage();
  const { colors, tints } = useTheme();
  const cfg = getRecordConfig(kind, t);
  const { refresh: refreshPatients } = usePatient();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    data: item,
    loading,
    error,
    reload,
  } = useFocusData(() => cfg.api.get(id), [kind, id]);

  const confirmDelete = () => {
    Alert.alert(t('record.deleteConfirmTitle'), localizeRecordTitle(item?.title || '', kind, t), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await cfg.api.remove(id);
            await refreshPatients();
            navigation.goBack();
          } catch (e) {
            Alert.alert(t('common.error'), (e as Error).message);
          }
        },
      },
    ]);
  };

  const confirmDeleteFile = (file: FileItem) => {
    Alert.alert(t('record.deleteFileTitle'), file.fileName, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await cfg.api.removeFile(id, file.id);
            await reload();
          } catch (e) {
            Alert.alert(t('common.error'), (e as Error).message);
          }
        },
      },
    ]);
  };

  const addMoreFiles = async () => {
    const picked = kind === 'complaint' ? await pickImages() : await pickDocuments();
    if (!picked.length) {
      return;
    }
    setUploading(true);
    try {
      for (const f of picked) {
        await cfg.api.upload(id, f);
      }
      await reload();
    } catch (e) {
      Alert.alert('Xəta', (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
        <ScreenHeader title={cfg.singular} />
        <Loading />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
        <ScreenHeader title={cfg.singular} />
        {error && <ErrorBanner message={error} onRetry={reload} />}
      </SafeAreaView>
    );
  }

  const { icon, tint } = recordVisual(kind, item);
  const { images, audios, docs } = splitFiles(item.files);
  const kindLabel = cfg.kinds.find(k => k.value === item.kind)?.label ?? item.kind;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.background }} className="flex-1">
      <ScreenHeader
        title={cfg.singular}
        right={
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => navigation.navigate('RecordForm', { kind, id: item.id })}
              hitSlop={12}
              style={{ backgroundColor: colors.primarySoft }}
              className="h-11 w-11 items-center justify-center rounded-2xl active:opacity-70">
              <Pencil size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={confirmDelete}
              hitSlop={12}
              style={{ backgroundColor: colors.dangerSoft }}
              className="h-11 w-11 items-center justify-center rounded-2xl active:opacity-70">
              <Trash2 size={20} color={colors.danger} />
            </Pressable>
          </View>
        }
      />

      <ScrollView className="flex-1 px-4 pt-2" contentContainerStyle={{ paddingBottom: 32 }}>
        <Card className="p-4.5">
          <View className="flex-row items-center">
            <IconTile icon={icon} tint={tint} size={54} iconSize={26} variant="soft" />
            <View className="ml-3.5 flex-1">
              <Text style={{ color: colors.text }} className="text-[20px] font-bold">{localizeRecordTitle(item.title, kind, t)}</Text>
              <Text style={{ color: colors.textMuted }} className="mt-1 text-[14px] font-medium">
                {formatDate(item.date, language)} • {kindLabel}
              </Text>
            </View>
          </View>

          {!!item.description &&
            item.description.trim().toLowerCase() !== item.title.trim().toLowerCase() && (
              <Text style={{ color: colors.text }} className="mt-4 text-[16px] leading-7">
                {item.description}
              </Text>
            )}
        </Card>

        {images.length > 0 && (
          <View className="mt-5">
            <Text style={{ color: colors.text }} className="mb-3 text-[17px] font-bold">
              {t('record.images')} ({images.length})
            </Text>
            <View className="flex-row flex-wrap gap-2.5">
              {images.map((img, i) => (
                <Pressable
                  key={img.id}
                  onPress={() => setViewerIndex(i)}
                  onLongPress={() => confirmDeleteFile(img)}
                  style={{ borderColor: colors.border, backgroundColor: colors.surface }}
                  className="overflow-hidden rounded-2xl border">
                  <Image
                    source={{ uri: fileUrl(img.filePath) }}
                    style={{ width: 104, height: 104 }}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {audios.length > 0 && (
          <View className="mt-5">
            <Text style={{ color: colors.text }} className="mb-2.5 text-[15px] font-semibold">
              {t('record.voiceNotes')} ({audios.length})
            </Text>
            {audios.map(a => (
              <Card key={a.id} className="mb-2.5 p-3">
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: colors.text }} className="flex-1 text-sm font-medium" numberOfLines={1}>
                    {a.fileName}
                  </Text>
                  <Pressable onPress={() => confirmDeleteFile(a)} hitSlop={8}>
                    <Trash2 size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
                <VoicePlayer uri={fileUrl(a.filePath)} fallbackLabel={formatSize(a.fileSize)} />
              </Card>
            ))}
          </View>
        )}

        {docs.length > 0 && (
          <View className="mt-5">
            <Text style={{ color: colors.text }} className="mb-2.5 text-[15px] font-semibold">
              {t('record.docs')} ({docs.length})
            </Text>
            {docs.map(d => {
              const badge = docLabel(d);
              const isPdf = badge === 'PDF';
              return (
                <Card
                  key={d.id}
                  onPress={() => openRemoteFile(d)}
                  className="mb-2.5 flex-row items-center p-3.5">
                  <View
                    style={{ backgroundColor: isPdf ? tints.red.bg : tints.blue.bg }}
                    className="h-11 w-11 items-center justify-center rounded-xl">
                    <FileText size={22} color={isPdf ? tints.red.fg : tints.blue.fg} />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text style={{ color: colors.text }} className="text-sm font-semibold" numberOfLines={1}>
                      {d.fileName}
                    </Text>
                    <Text style={{ color: colors.textMuted }} className="mt-0.5 text-xs">
                      {badge} • {formatSize(d.fileSize)}
                    </Text>
                  </View>
                  <ExternalLink size={16} color={colors.textMuted} />
                  <Pressable
                    onPress={() => confirmDeleteFile(d)}
                    hitSlop={10}
                    className="ml-3 p-1">
                    <Trash2 size={16} color={colors.textMuted} />
                  </Pressable>
                </Card>
              );
            })}
          </View>
        )}

        <View className="mt-6">
          <Button
            label={t('record.addFile')}
            icon={Plus}
            variant="soft"
            loading={uploading}
            onPress={addMoreFiles}
          />
        </View>
      </ScrollView>

      <ImageViewer
        uris={images.map(f => fileUrl(f.filePath) ?? '')}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </SafeAreaView>
  );
}

