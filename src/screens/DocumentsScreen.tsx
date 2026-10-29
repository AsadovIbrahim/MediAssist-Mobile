import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ExternalLink, FileText, Mic } from 'lucide-react-native';
import { fileUrl } from '../api/client';
import type { FileItem } from '../api/types';
import { openRemoteFile, VoicePlayer } from '../components/media';
import {
  Card,
  EmptyState,
  ErrorBanner,
  FilterChips,
  Loading,
  SearchBar,
  type ChipOption,
} from '../components/ui';
import { usePatient } from '../context/PatientContext';
import { RECORDS, type RecordKind } from '../features/records';
import { colors, tints } from '../theme';
import { formatDate, formatSize } from '../utils/format';
import { useFocusData } from '../utils/hooks';
import { docLabel, isAudioFile, isImageFile } from '../utils/media';

type Filter = 'all' | 'doc' | 'image' | 'audio';

const FILTERS: ChipOption<Filter>[] = [
  { value: 'all', label: 'Hamısı' },
  { value: 'doc', label: 'Sənədlər' },
  { value: 'image', label: 'Şəkillər' },
  { value: 'audio', label: 'Səs qeydləri' },
];

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
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

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
    const [complaints, diagnoses, treatments] = await Promise.all([
      RECORDS.complaint.api.list(patient.id),
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
    collect('diagnosis', diagnoses);
    collect('treatment', treatments);
    collect('complaint', complaints);
    return list;
  }, [patient?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allFiles ?? []).filter(({ file, recordTitle }) => {
      if (filter === 'image' && !isImageFile(file)) {
        return false;
      }
      if (filter === 'audio' && !isAudioFile(file)) {
        return false;
      }
      if (filter === 'doc' && (isImageFile(file) || isAudioFile(file))) {
        return false;
      }
      if (q) {
        return (
          file.fileName.toLowerCase().includes(q) || recordTitle.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allFiles, filter, search]);

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

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

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
                onPress={() =>
                  isAud
                    ? navigation.navigate('RecordDetail', { kind, id: recordId })
                    : openRemoteFile(file)
                }
                className="mx-4 mb-3 p-3.5">
                <View className="flex-row items-center">
                  {isImg ? (
                    <Image
                      source={{ uri: fileUrl(file.filePath) }}
                      style={{ width: 46, height: 46, borderRadius: 10 }}
                    />
                  ) : isAud ? (
                    <View
                      style={{ backgroundColor: tints.green.bg }}
                      className="h-11 w-11 items-center justify-center rounded-xl">
                      <Mic size={20} color={tints.green.fg} />
                    </View>
                  ) : (
                    <View
                      style={{
                        backgroundColor: badge === 'PDF' ? tints.red.bg : tints.blue.bg,
                      }}
                      className="h-11 w-11 items-center justify-center rounded-xl">
                      <FileText
                        size={20}
                        color={badge === 'PDF' ? tints.red.fg : tints.blue.fg}
                      />
                    </View>
                  )}
                  <View className="ml-3 flex-1">
                    <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
                      {recordTitle}
                    </Text>
                    <Text className="mt-0.5 text-xs text-ink-muted" numberOfLines={1}>
                      {file.fileName} • {formatSize(file.fileSize)} • {formatDate(recordDate)}
                    </Text>
                  </View>
                  <ExternalLink size={16} color={colors.textLight} />
                </View>
                {isAud && <VoicePlayer uri={fileUrl(file.filePath)} />}
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={FileText}
              title="Sənəd tapılmadı"
              text="Şikayət, diaqnoz və müalicələrə əlavə edilən bütün fayllar burada görünəcək."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

