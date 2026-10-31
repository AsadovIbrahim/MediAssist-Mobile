import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight, Eye, FileText, Mic } from 'lucide-react-native';
import { fileUrl } from '../api/client';
import type { FileItem } from '../api/types';
import { ImageViewer, openRemoteFile, VoicePlayer } from '../components/media';
import {
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  SearchBar,
} from '../components/ui';
import { usePatient } from '../context/PatientContext';
import { RECORDS, type RecordKind } from '../features/records';
import { colors, tints } from '../theme';
import { formatDate, formatSize } from '../utils/format';
import { useFocusData } from '../utils/hooks';
import { docLabel, isAudioFile, isImageFile } from '../utils/media';

interface AggregatedFile {
  file: FileItem;
  recordId: string;
  recordTitle: string;
  recordDate: string;
  kind: RecordKind;
}

export function DocumentsScreen() {
  const navigation = useNavigation();
  const { patient } = usePatient();
  const [search, setSearch] = useState('');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const {
    data: allFiles,
    loading,
    refreshing,
    error,
    reload,
  } = useFocusData(async () => {
    if (!patient) {
      return [];
    }
    const [complaints, examinations, diagnoses, treatments] = await Promise.all([
      RECORDS.complaint.api.list(patient.id),
      RECORDS.examination.api.list(patient.id),
      RECORDS.diagnosis.api.list(patient.id),
      RECORDS.treatment.api.list(patient.id),
    ]);
    const list: AggregatedFile[] = [];
    const collect = (kind: RecordKind, items: typeof complaints) => {
      for (const rec of items) {
        for (const f of rec.files) {
          list.push({
            file: f,
            recordId: rec.id,
            recordTitle: rec.title,
            recordDate: rec.date,
            kind,
          });
        }
      }
    };
    collect('examination', examinations);
    collect('diagnosis', diagnoses);
    collect('treatment', treatments);
    collect('complaint', complaints);
    return list;
  }, [patient?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return allFiles ?? [];
    }
    return (allFiles ?? []).filter(
      ({ file, recordTitle }) =>
        file.fileName.toLowerCase().includes(q) || recordTitle.toLowerCase().includes(q),
    );
  }, [allFiles, search]);

  const imageList = useMemo(() => {
    return (filtered ?? [])
      .filter(item => isImageFile(item.file))
      .map(item => ({
        uri: fileUrl(item.file.filePath) ?? '',
        fileId: item.file.id,
      }))
      .filter(x => !!x.uri);
  }, [filtered]);

  const openImage = (file: FileItem) => {
    const targetUri = fileUrl(file.filePath);
    const idx = imageList.findIndex(x => x.fileId === file.id || x.uri === targetUri);
    if (idx !== -1) {
      setViewerIndex(idx);
    } else if (targetUri) {
      setViewerIndex(0);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <View className="px-5 pt-3 pb-3">
        <Text className="text-2xl font-bold text-ink">Sənədlər</Text>
      </View>

      <SearchBar
        placeholder="Fayl və ya sənəd axtar..."
        value={search}
        onChangeText={setSearch}
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.file.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
          renderItem={({ item }) => {
            const { file, recordTitle, recordDate, kind, recordId } = item;
            const isImg = isImageFile(file);
            const isAud = isAudioFile(file);
            const badge = docLabel(file);

            return (
              <Card
                onPress={() => {
                  if (isImg) {
                    openImage(file);
                  } else {
                    navigation.navigate('RecordDetail', { kind, id: recordId });
                  }
                }}
                className="mx-4 mb-3.5 p-4">
                <View className="flex-row items-center">
                  {isImg ? (
                    <Pressable
                      onPress={() => openImage(file)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Şəkli tam ekranda aç"
                      className="relative overflow-hidden rounded-2xl border border-line active:opacity-80">
                      <Image
                        source={{ uri: fileUrl(file.filePath) }}
                        style={{ width: 56, height: 56 }}
                        resizeMode="cover"
                      />
                      <View className="absolute bottom-1 right-1 rounded-md bg-black/60 p-1">
                        <Eye size={12} color="#fff" strokeWidth={2.4} />
                      </View>
                    </Pressable>
                  ) : isAud ? (
                    <View
                      style={{ backgroundColor: tints.green.bg }}
                      className="h-14 w-14 items-center justify-center rounded-2xl">
                      <Mic size={26} color={tints.green.fg} />
                    </View>
                  ) : (
                    <View
                      style={{
                        backgroundColor: badge === 'PDF' ? tints.red.bg : tints.blue.bg,
                      }}
                      className="h-14 w-14 items-center justify-center rounded-2xl">
                      <FileText
                        size={26}
                        color={badge === 'PDF' ? tints.red.fg : tints.blue.fg}
                      />
                    </View>
                  )}

                  <View className="ml-3.5 flex-1 justify-center">
                    <Text className="text-[17px] font-bold text-ink" numberOfLines={1}>
                      {recordTitle}
                    </Text>
                    <Text
                      className="mt-1 text-[14px] font-medium text-ink-muted"
                      numberOfLines={1}>
                      {file.fileName} • {formatSize(file.fileSize)} • {formatDate(recordDate)}
                    </Text>
                  </View>

                  <View className="ml-2 flex-row items-center gap-1.5">
                    {isImg && (
                      <Pressable
                        onPress={() => openImage(file)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Şəkli böyüt"
                        className="h-11 w-11 items-center justify-center rounded-xl bg-primary-soft active:opacity-70">
                        <Eye size={20} color={colors.primary} strokeWidth={2.2} />
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => navigation.navigate('RecordDetail', { kind, id: recordId })}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Qeydə bax"
                      className="h-11 w-11 items-center justify-center rounded-xl bg-surface active:opacity-70">
                      <ChevronRight size={22} color={colors.textLight} strokeWidth={2.4} />
                    </Pressable>
                  </View>
                </View>

                {isAud && (
                  <View className="mt-3">
                    <VoicePlayer uri={fileUrl(file.filePath)} fallbackLabel={formatSize(file.fileSize)} />
                  </View>
                )}
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={FileText}
              title="Sənəd tapılmadı"
              text="Şikayət, müayinə, diaqnoz və müalicələrə əlavə edilən bütün fayllar burada görünəcək."
            />
          }
        />
      )}

      <ImageViewer
        uris={imageList.map(x => x.uri)}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </SafeAreaView>
  );
}
