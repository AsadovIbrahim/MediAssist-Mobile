import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Search as SearchIcon } from 'lucide-react-native';
import { patientsApi } from '../api/services';
import type { Patient } from '../api/types';
import { RecordCard } from '../components/RecordCard';
import {
  EmptyState,
  ErrorBanner,
  Loading,
  SearchBar,
} from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';
import { RECORDS, type RecordItem, type RecordKind } from '../features/records';
import { useDebounced, useFocusData } from '../utils/hooks';

interface SearchResultItem {
  kind: RecordKind;
  item: RecordItem;
  patientId: string;
  patientName: string;
}

export function SearchScreen() {
  const navigation = useNavigation();
  const { patient, patients, select } = usePatient();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);

  const {
    data: allRecords,
    loading,
    refreshing,
    error,
    reload,
  } = useFocusData(async () => {
    let targetList: Patient[] = [];
    if (patients && patients.length > 0) {
      targetList = patients;
    } else {
      const list = await patientsApi.list().catch(() => []);
      targetList = list;
    }
    if (targetList.length === 0 && patient) {
      targetList = [patient];
    }
    if (targetList.length === 0) {
      return [];
    }

    const list: SearchResultItem[] = [];
    await Promise.all(
      targetList.map(async p => {
        try {
          const pName = `${p.firstName} ${p.lastName}`.trim();
          const [complaints, examinations, diagnoses, treatments] = await Promise.all([
            RECORDS.complaint.api.list(p.id).catch(() => []),
            RECORDS.examination.api.list(p.id).catch(() => []),
            RECORDS.diagnosis.api.list(p.id).catch(() => []),
            RECORDS.treatment.api.list(p.id).catch(() => []),
          ]);
          for (const item of complaints) {
            list.push({ kind: 'complaint', item, patientId: p.id, patientName: pName });
          }
          for (const item of examinations) {
            list.push({ kind: 'examination', item, patientId: p.id, patientName: pName });
          }
          for (const item of diagnoses) {
            list.push({ kind: 'diagnosis', item, patientId: p.id, patientName: pName });
          }
          for (const item of treatments) {
            list.push({ kind: 'treatment', item, patientId: p.id, patientName: pName });
          }
        } catch {
          // Ignore error for individual patient
        }
      }),
    );

    // Sort newest first
    list.sort((a, b) => {
      const da = new Date(a.item.date).getTime() || 0;
      const db = new Date(b.item.date).getTime() || 0;
      return db - da;
    });

    return list;
  }, [patient?.id, patients?.length]);

  useEffect(() => {
    reload();
  }, [patient?.id, patients?.length]);

  const filtered = useMemo(() => {
    const list = allRecords ?? [];
    const q = debounced.trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter(r => {
      const matchTitle = r.item.title?.toLowerCase().includes(q);
      const matchDesc = r.item.description?.toLowerCase().includes(q);
      const matchPatient = r.patientName?.toLowerCase().includes(q);
      const matchKind = r.kind.toLowerCase().includes(q);
      const matchFiles = r.item.files?.some(f => f.fileName?.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchPatient || matchKind || matchFiles;
    });
  }, [allRecords, debounced]);

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1">
      <View className="px-5 pt-3 pb-3">
        <Text style={{ color: colors.text }} className="text-2xl font-bold">{t('search.title')}</Text>
      </View>

      <SearchBar
        placeholder={t('search.placeholder')}
        value={query}
        onChangeText={setQuery}
        autoFocus={false}
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {loading && !allRecords ? (
        <Loading />
      ) : (
        <FlatList<SearchResultItem>
          data={filtered}
          keyExtractor={r => `${r.patientId}-${r.kind}-${r.item.id}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
          renderItem={({ item: row }) => (
            <RecordCard
              kind={row.kind}
              item={row.item}
              patientName={row.patientName}
              onPress={async () => {
                if (row.patientId) {
                  await select(row.patientId);
                }
                navigation.navigate('RecordDetail', {
                  kind: row.kind,
                  id: row.item.id,
                });
              }}
              onEdit={async () => {
                if (row.patientId) {
                  await select(row.patientId);
                }
                navigation.navigate('RecordForm', {
                  kind: row.kind,
                  id: row.item.id,
                });
              }}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={SearchIcon}
              title={t('search.emptyTitle')}
              text={t('search.emptyDesc')}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
