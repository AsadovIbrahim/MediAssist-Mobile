import React, { useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText } from 'lucide-react-native';
import { RecordCard } from '../components/RecordCard';
import {
  AddButton,
  Button,
  EmptyState,
  ErrorBanner,
  Loading,
  ScreenHeader,
  SearchBar,
} from '../components/ui';
import { usePatient } from '../context/PatientContext';
import { RECORDS } from '../features/records';
import type { RootScreenProps } from '../navigation/types';
import { useDebounced, useFocusData } from '../utils/hooks';

export function RecordListScreen({ navigation, route }: RootScreenProps<'RecordList'>) {
  const { kind } = route.params;
  const cfg = RECORDS[kind];
  const { patient } = usePatient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);

  const {
    data: items,
    loading,
    refreshing,
    error,
    reload,
  } = useFocusData(async () => {
    if (!patient) {
      return [];
    }
    return cfg.api.list(
      patient.id,
      undefined,
      debouncedSearch.trim() || undefined,
    );
  }, [patient?.id, kind, debouncedSearch]);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <ScreenHeader
        title={cfg.title}
        right={
          <AddButton
            onPress={() => navigation.navigate('RecordForm', { kind })}
          />
        }
      />

      <SearchBar
        placeholder={cfg.searchPlaceholder}
        value={search}
        onChangeText={setSearch}
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
          renderItem={({ item }) => (
            <RecordCard
              kind={kind}
              item={item}
              onPress={() => navigation.navigate('RecordDetail', { kind, id: item.id })}
              onEdit={() => navigation.navigate('RecordForm', { kind, id: item.id })}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={FileText}
              title={cfg.emptyText}
              action={
                <Button
                  label="Əlavə et"
                  onPress={() => navigation.navigate('RecordForm', { kind })}
                />
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

