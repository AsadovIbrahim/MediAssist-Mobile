import React, { useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText } from 'lucide-react-native';
import { RecordCard } from '../components/RecordCard';
import { OfflineBanner } from '../components/OfflineBanner';
import {
  AddButton,
  Button,
  EmptyState,
  ErrorBanner,
  Loading,
  ScreenHeader,
  SearchBar,
} from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';
import { getRecordConfig, RECORDS } from '../features/records';
import type { RootScreenProps } from '../navigation/types';
import { useDebounced, useFocusData } from '../utils/hooks';

export function RecordListScreen({ navigation, route }: RootScreenProps<'RecordList'>) {
  const { kind } = route.params;
  const { t } = useLanguage();
  const { colors } = useTheme();
  const cfg = getRecordConfig(kind, t);
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
    <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.background }} className="flex-1">
      <ScreenHeader
        title={cfg.title}
        right={
          <AddButton
            label={t('common.add')}
            onPress={() => navigation.navigate('RecordForm', { kind })}
          />
        }
      />

      <SearchBar
        placeholder={cfg.searchPlaceholder}
        value={search}
        onChangeText={setSearch}
      />

      <OfflineBanner onSyncComplete={reload} />
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
                  label={t('common.add')}
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

