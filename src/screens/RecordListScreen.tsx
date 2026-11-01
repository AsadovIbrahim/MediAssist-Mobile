import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckSquare, FileText, Trash2, X } from 'lucide-react-native';
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
import { getRecordConfig } from '../features/records';
import type { RootScreenProps } from '../navigation/types';
import { useDebounced, useFocusData } from '../utils/hooks';
import { offlineStorage } from '../utils/offlineStorage';

export function RecordListScreen({ navigation, route }: RootScreenProps<'RecordList'>) {
  const { kind } = route.params;
  const { t } = useLanguage();
  const { colors, isDark } = useTheme();
  const cfg = getRecordConfig(kind, t);
  const { patient, refresh: refreshPatients } = usePatient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);

  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

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

  const enterSelectionMode = (initialId?: string) => {
    setSelectionMode(true);
    if (initialId) {
      setSelectedIds(new Set([initialId]));
    } else {
      setSelectedIds(new Set());
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!items || items.length === 0) return;
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0 || !patient) return;
    const count = selectedIds.size;
    Alert.alert(
      t('common.delete') || 'Sil',
      `Seçilmiş ${count} sənədi silmək istədiyinizə əminsiniz?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const idsToDelete = Array.from(selectedIds);
              for (const id of idsToDelete) {
                try {
                  if (id.startsWith('local_')) {
                    const q = await offlineStorage.getQueue();
                    const match = q.find(x => x.recordId === id);
                    if (match) {
                      await offlineStorage.dequeue(match.id);
                    }
                  } else {
                    await cfg.api.remove(id);
                  }
                } catch {}
              }

              // Purge removed items from local cache
              const cached = await offlineStorage.getRecords(patient.id, kind);
              if (cached) {
                const remaining = cached.filter(r => !selectedIds.has(r.id));
                await offlineStorage.saveRecords(patient.id, kind, remaining);
              }

              await refreshPatients();
              exitSelectionMode();
              await reload();
            } catch (err: any) {
              Alert.alert(t('common.error'), err?.message || 'Xəta baş verdi');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.background }} className="flex-1">
      {selectionMode ? (
        <View className="flex-row items-center justify-between px-4 pt-3 pb-3">
          <View className="flex-1 flex-row items-center">
            <Pressable
              onPress={exitSelectionMode}
              hitSlop={14}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="mr-3 h-11 w-11 items-center justify-center rounded-2xl border active:opacity-70 shadow-sm">
              <X size={22} color={colors.text} />
            </Pressable>
            <Text style={{ color: colors.text }} className="text-[19px] font-bold">
              {selectedIds.size} {t('common.selected') || 'seçildi'}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={toggleSelectAll}
              hitSlop={10}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="h-10 px-3 items-center justify-center rounded-xl border active:opacity-70">
              <Text style={{ color: colors.primary }} className="text-[13px] font-semibold">
                {selectedIds.size === (items?.length ?? 0) ? (t('common.deselectAll') || 'Ləğv et') : (t('common.selectAll') || 'Hamısı')}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDeleteSelected}
              disabled={selectedIds.size === 0 || deleting}
              hitSlop={10}
              style={{
                backgroundColor: selectedIds.size > 0 ? (isDark ? '#7F1D1D' : '#FEE2E2') : colors.surface,
                borderColor: selectedIds.size > 0 ? (isDark ? '#991B1B' : '#FECACA') : colors.border,
                opacity: selectedIds.size === 0 ? 0.4 : 1,
              }}
              className="h-10 flex-row items-center justify-center rounded-xl border px-3.5 active:opacity-70">
              {deleting ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <>
                  <Trash2 size={16} color="#DC2626" />
                  <Text className="ml-1.5 text-[13px] font-bold text-red-600">
                    {t('common.delete') || 'Sil'} ({selectedIds.size})
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <ScreenHeader
          title={cfg.title}
          right={
            <View className="flex-row items-center gap-2">
              {(items?.length ?? 0) > 0 && (
                <Pressable
                  onPress={() => enterSelectionMode()}
                  hitSlop={10}
                  accessibilityLabel="Seçim rejimi"
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  className="h-11 px-3 items-center justify-center rounded-2xl border active:opacity-70 shadow-sm">
                  <CheckSquare size={20} color={colors.text} />
                </Pressable>
              )}
              <AddButton
                label={t('common.add')}
                onPress={() => navigation.navigate('RecordForm', { kind })}
              />
            </View>
          }
        />
      )}

      {!selectionMode && (
        <SearchBar
          placeholder={cfg.searchPlaceholder}
          value={search}
          onChangeText={setSearch}
        />
      )}

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
              selectionMode={selectionMode}
              selected={selectedIds.has(item.id)}
              onPress={() => {
                if (selectionMode) {
                  toggleSelect(item.id);
                } else {
                  navigation.navigate('RecordDetail', { kind, id: item.id });
                }
              }}
              onLongPress={() => {
                if (!selectionMode) {
                  enterSelectionMode(item.id);
                }
              }}
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
