import React, { useEffect, useMemo, useState } from 'react';
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
import { patientsApi } from '../api/services';
import type { FileItem, Patient } from '../api/types';
import { ImageViewer, openRemoteFile, VoicePlayer } from '../components/media';
import {
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  SearchBar,
} from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { patientFullName, usePatient } from '../context/PatientContext';
import { localizeRecordTitle, RECORDS, type RecordKind } from '../features/records';
import { useTheme } from '../context/ThemeContext';
import { formatDate, formatSize } from '../utils/format';
import { useFocusData } from '../utils/hooks';
import { docLabel, isAudioFile, isImageFile } from '../utils/media';

interface AggregatedFile {
  file: FileItem;
  recordId: string;
  recordTitle: string;
  recordDate: string;
  kind: RecordKind;
  patientId: string;
  patientName: string;
}

export function DocumentsScreen() {
  const navigation = useNavigation();
  const { patient, patients } = usePatient();
  const { language, t } = useLanguage();
  const { colors, tints, isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const {
    data: allFiles,
    loading,
    refreshing,
    error,
    reload,
  } = useFocusData(async () => {
    let targetList: Patient[] = [];
    if (patients && patients.length > 0) {
      targetList = patients;
    } else {
      const fetched = await patientsApi.list().catch(() => []);
      targetList = fetched;
    }

    if (targetList.length === 0 && patient) {
      targetList = [patient];
    }

    if (targetList.length === 0) {
      return [];
    }

    const list: AggregatedFile[] = [];
    await Promise.all(
      targetList.map(async p => {
        try {
          const [complaints, examinations, diagnoses, treatments] = await Promise.all([
            RECORDS.complaint.api.list(p.id).catch(() => []),
            RECORDS.examination.api.list(p.id).catch(() => []),
            RECORDS.diagnosis.api.list(p.id).catch(() => []),
            RECORDS.treatment.api.list(p.id).catch(() => []),
          ]);
          const fullName = patientFullName(p);
          const collect = (kind: RecordKind, items: typeof complaints) => {
            for (const rec of items) {
              for (const f of rec.files ?? []) {
                list.push({
                  file: f,
                  recordId: rec.id,
                  recordTitle: rec.title,
                  recordDate: rec.date,
                  kind,
                  patientId: p.id,
                  patientName: fullName,
                });
              }
            }
          };
          collect('examination', examinations);
          collect('diagnosis', diagnoses);
          collect('treatment', treatments);
          collect('complaint', complaints);
        } catch {
          // ignore individual patient errors
        }
      }),
    );

    return list.sort(
      (a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime(),
    );
  }, [patient?.id, patients?.length]);

  useEffect(() => {
    reload();
  }, [patient?.id, patients?.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return allFiles ?? [];
    }
    return (allFiles ?? []).filter(
      ({ file, recordTitle, patientName }) =>
        file.fileName.toLowerCase().includes(q) ||
        recordTitle.toLowerCase().includes(q) ||
        patientName.toLowerCase().includes(q),
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
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1">
      <View className="px-5 pt-3 pb-3">
        <Text style={{ color: colors.text }} className="text-2xl font-bold">{t('documents.title')}</Text>
      </View>

      <SearchBar
        placeholder={t('documents.searchPlaceholder')}
        value={search}
        onChangeText={setSearch}
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => `${item.patientId}-${item.file.id}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
          renderItem={({ item }) => {
            const { file, recordTitle, recordDate, kind, recordId, patientName } = item;
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
                      style={{ borderColor: colors.border }}
                      className="relative overflow-hidden rounded-2xl border active:opacity-80">
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
                    <Text style={{ color: colors.text }} className="text-[17px] font-bold" numberOfLines={1}>
                      {localizeRecordTitle(recordTitle, kind, t)}
                    </Text>
                    <Text
                      style={{ color: colors.textMuted }}
                      className="mt-1 text-[13px] font-medium"
                      numberOfLines={1}>
                      {patientName} • {file.fileName} • {formatSize(file.fileSize)}
                    </Text>
                    <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[12px]">
                      {formatDate(recordDate, language)}
                    </Text>
                  </View>

                  <View className="ml-2 flex-row items-center gap-1.5">
                    {isImg && (
                      <Pressable
                        onPress={() => openImage(file)}
                        hitSlop={8}
                        accessibilityRole="button"
                        style={{ backgroundColor: isDark ? '#1E3A8A' : colors.primarySoft }}
                        className="h-11 w-11 items-center justify-center rounded-xl active:opacity-70">
                        <Eye size={20} color={colors.primary} strokeWidth={2.2} />
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => navigation.navigate('RecordDetail', { kind, id: recordId })}
                      hitSlop={8}
                      accessibilityRole="button"
                      style={{ backgroundColor: isDark ? '#263345' : colors.surface }}
                      className="h-11 w-11 items-center justify-center rounded-xl active:opacity-70">
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
              title={t('documents.emptyTitle')}
              text={t('documents.emptyDesc')}
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
