import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Search as SearchIcon } from 'lucide-react-native';
import { RecordCard } from '../components/RecordCard';
import {
  EmptyState,
  ErrorBanner,
  FilterChips,
  Loading,
  SearchBar,
  type ChipOption,
} from '../components/ui';
import { usePatient } from '../context/PatientContext';
import { RECORDS, type RecordItem, type RecordKind } from '../features/records';
import { useDebounced, useFocusData } from '../utils/hooks';

type Scope = 'all' | RecordKind;

const SCOPES: ChipOption<Scope>[] = [
  { value: 'all', label: 'Hamısı' },
  { value: 'complaint', label: 'Şikayətlər' },
  { value: 'diagnosis', label: 'Diaqnoz' },
  { value: 'treatment', label: 'Müalicə' },
];

export function SearchScreen() {
  const navigation = useNavigation();
  const { patient } = usePatient();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const debounced = useDebounced(query, 300);

  const {
    data: results,
    loading,
    refreshing,
    error,
    reload,
  } = useFocusData(async () => {
    if (!patient) {
      return [];
    }
    const q = debounced.trim() || undefined;
    const [complaints, diagnoses, treatments] = await Promise.all([
      RECORDS.complaint.api.list(patient.id, undefined, q),
      RECORDS.diagnosis.api.list(patient.id, undefined, q),
      RECORDS.treatment.api.list(patient.id, undefined, q),
    ]);
    return [
      ...complaints.map(item => ({ kind: 'complaint' as const, item })),
      ...diagnoses.map(item => ({ kind: 'diagnosis' as const, item })),
      ...treatments.map(item => ({ kind: 'treatment' as const, item })),
    ];
  }, [patient?.id, debounced]);

  const filtered = useMemo(
    () => (results ?? []).filter(r => scope === 'all' || r.kind === scope),
    [results, scope],
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <View className="px-5 pt-3 pb-3">
        <Text className="text-2xl font-bold text-ink">Axtarış</Text>
      </View>

      <SearchBar
        placeholder="Şikayət, diaqnoz və ya müalicə axtar..."
        value={query}
        onChangeText={setQuery}
        autoFocus={false}
      />

      <FilterChips options={SCOPES} value={scope} onChange={setScope} />

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {loading ? (
        <Loading />
      ) : (
        <FlatList<{ kind: RecordKind; item: RecordItem }>
          data={filtered}
          keyExtractor={r => `${r.kind}-${r.item.id}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
          renderItem={({ item: row }) => (
            <RecordCard
              kind={row.kind}
              item={row.item}
              onPress={() =>
                navigation.navigate('RecordDetail', {
                  kind: row.kind,
                  id: row.item.id,
                })
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={SearchIcon}
              title="Nəticə tapılmadı"
              text="Axtarış sözünü dəyişərək yenidən yoxlayın."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

