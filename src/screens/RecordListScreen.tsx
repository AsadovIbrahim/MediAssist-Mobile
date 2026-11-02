import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Calendar as CalendarIcon,
  Camera,
  Check,
  CheckSquare,
  ChevronLeft,
  FileText,
  FileUp,
  Image as ImageIcon,
  Mic,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import { fileUrl } from '../api/client';
import type { FileItem, LocalFile } from '../api/types';
import { DatePickerModal } from '../components/DatePickerModal';
import { RecorderModal } from '../components/media';
import { OfflineBanner } from '../components/OfflineBanner';
import { RecordCard } from '../components/RecordCard';
import { Card, ErrorBanner, IconTile, Loading, SearchBar } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';
import { getRecordConfig, type UploadSource } from '../features/records';
import type { RootScreenProps } from '../navigation/types';
import { formatDate, toApiDate } from '../utils/format';
import { useDebounced, useFocusData } from '../utils/hooks';
import { pickDocuments, pickImages, takePhoto } from '../utils/media';
import { offlineStorage } from '../utils/offlineStorage';

export function RecordListScreen({ navigation, route }: RootScreenProps<'RecordList'>) {
  const { kind } = route.params;
  const { language, t } = useLanguage();
  const { colors, tints, isDark } = useTheme();
  const cfg = getRecordConfig(kind, t);
  const { patient, refresh: refreshPatients } = usePatient();

  // Search
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);

  // Editor states
  const [text, setText] = useState('');
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [date, setDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saving' | 'saved' | null>(null);

  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Refs for tracking values during beforeRemove auto-save
  const textRef = useRef(text);
  textRef.current = text;
  const filesRef = useRef(files);
  filesRef.current = files;
  const dateRef = useRef(date);
  dateRef.current = date;
  const editingRecordIdRef = useRef(editingRecordId);
  editingRecordIdRef.current = editingRecordId;
  const isSavingRef = useRef(false);

  // Fetch existing records
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

  // Core save function
  const saveCurrentInput = async (isLeaving = false): Promise<boolean> => {
    const trimmed = textRef.current.trim();
    const currentFiles = filesRef.current;

    // Nothing to save
    if (!trimmed && currentFiles.length === 0) {
      return true;
    }
    if (!patient) {
      return false;
    }
    if (isSavingRef.current) {
      return true;
    }

    isSavingRef.current = true;
    setAutoSaveStatus('saving');

    try {
      const firstLine = trimmed.split('\n')[0].trim();
      const finalTitle =
        firstLine.length > 0
          ? firstLine.length > 50
            ? `${firstLine.slice(0, 47)}...`
            : firstLine
          : currentFiles.some(f => f.kind === 'audio')
          ? `${cfg.singular} ${t('record.voiceSuffix')}`
          : currentFiles.length > 0
          ? `${cfg.singular} ${t('record.fileSuffix')}`
          : `${cfg.singular} ${t('record.recordSuffix')}`;

      const targetKind =
        currentFiles.some(f => f.kind === 'audio')
          ? 'Voice'
          : currentFiles.some(f => f.kind === 'image')
          ? 'Image'
          : currentFiles.some(f => f.kind === 'document')
          ? 'Document'
          : cfg.defaultKind;

      const isEditing = !!editingRecordIdRef.current;
      const targetId = editingRecordIdRef.current;

      if (isEditing && targetId) {
        await cfg.api.update(
          targetId,
          {
            patientId: patient.id,
            title: finalTitle,
            description: trimmed || null,
            kind: targetKind,
            date: toApiDate(dateRef.current),
          },
          currentFiles,
        );
      } else {
        const created = await cfg.api.create(
          {
            patientId: patient.id,
            title: finalTitle,
            description: trimmed || null,
            kind: targetKind,
            date: toApiDate(dateRef.current),
          },
          currentFiles,
        );
        if (!created.id.startsWith('local_') && currentFiles.length > 0) {
          for (const file of currentFiles) {
            try {
              await cfg.api.upload(created.id, file);
            } catch {}
          }
        }
      }

      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus(null), 2000);

      if (!isLeaving) {
        setText('');
        textRef.current = '';
        setFiles([]);
        filesRef.current = [];
        setEditingRecordId(null);
        editingRecordIdRef.current = null;
        setEditingTitle('');
        setDate(new Date());
        dateRef.current = new Date();
      }

      await refreshPatients();
      await reload();
      return true;
    } catch (e: any) {
      setAutoSaveStatus(null);
      if (!isLeaving) {
        Alert.alert(t('common.error'), e?.message || 'Xəta baş verdi');
      }
      return false;
    } finally {
      isSavingRef.current = false;
    }
  };

  // Auto-save on navigating back
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      const trimmed = textRef.current.trim();
      const currentFiles = filesRef.current;

      // If nothing entered or already saving, let navigation happen
      if ((!trimmed && currentFiles.length === 0) || isSavingRef.current) {
        return;
      }

      // Intercept navigation, save, and proceed
      e.preventDefault();
      saveCurrentInput(true).then(() => {
        navigation.dispatch(e.data.action);
      });
    });

    return unsubscribe;
  }, [navigation]);

  // Media attachment handlers
  const appendFiles = (incoming: LocalFile[]) => {
    if (!incoming.length) return;
    setFiles(prev => [...prev, ...incoming]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
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

  // Edit existing record inline
  const startEditingRecord = (item: any) => {
    setEditingRecordId(item.id);
    editingRecordIdRef.current = item.id;
    setEditingTitle(item.title);
    setText(item.description ?? item.title ?? '');
    textRef.current = item.description ?? item.title ?? '';
    if (item.date) {
      setDate(new Date(item.date));
      dateRef.current = new Date(item.date);
    }
    setFiles([]);
    filesRef.current = [];
  };

  const cancelEditing = () => {
    setEditingRecordId(null);
    editingRecordIdRef.current = null;
    setEditingTitle('');
    setText('');
    textRef.current = '';
    setFiles([]);
    filesRef.current = [];
    setDate(new Date());
    dateRef.current = new Date();
  };

  // Multi-select handlers
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
      {/* Navigation Header */}
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
                {selectedIds.size === (items?.length ?? 0)
                  ? t('common.deselectAll') || 'Ləğv et'
                  : t('common.selectAll') || 'Hamısı'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDeleteSelected}
              disabled={selectedIds.size === 0 || deleting}
              hitSlop={10}
              style={{
                backgroundColor:
                  selectedIds.size > 0
                    ? isDark
                      ? '#7F1D1D'
                      : '#FEE2E2'
                    : colors.surface,
                borderColor:
                  selectedIds.size > 0
                    ? isDark
                      ? '#991B1B'
                      : '#FECACA'
                    : colors.border,
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
        <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
          <View className="flex-row items-center flex-1">
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={14}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="mr-3 h-11 w-11 items-center justify-center rounded-2xl border active:opacity-70 shadow-sm">
              <ChevronLeft size={24} color={colors.text} />
            </Pressable>
            <Text style={{ color: colors.text }} className="text-[21px] font-bold" numberOfLines={1}>
              {cfg.title}
            </Text>
          </View>

          {/* Header Action: Multi-select */}
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
        </View>
      )}

      {/* Offline Banner & Error */}
      <OfflineBanner onSyncComplete={reload} />
      {error && <ErrorBanner message={error} onRetry={reload} />}

      {/* Persistent Quick Input Composer Card (OUTSIDE FlatList to guarantee uninterrupted focus!) */}
      {!selectionMode && (
        <View className="px-4">
          <Card className="mb-3 p-4 shadow-sm">
            {/* Header Row of Composer */}
            <View className="mb-2 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 pr-2">
                <View
                  style={{
                    backgroundColor: editingRecordId ? '#2563EB' : colors.primary,
                  }}
                  className="mr-2 h-2.5 w-2.5 rounded-full"
                />
                <Text
                  style={{ color: colors.text }}
                  className="text-[15px] font-bold"
                  numberOfLines={1}>
                  {editingRecordId
                    ? `Düzəliş edilir: ${editingTitle}`
                    : `Yeni ${cfg.singular.toLowerCase()} yazın`}
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                {autoSaveStatus && (
                  <View className="flex-row items-center">
                    {autoSaveStatus === 'saving' ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={{ transform: [{ scale: 0.7 }] }}
                      />
                    ) : (
                      <Text className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Yadda saxlanıldı ✓
                      </Text>
                    )}
                  </View>
                )}

                {editingRecordId && (
                  <Pressable
                    onPress={cancelEditing}
                    hitSlop={8}
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    className="rounded-lg border px-2.5 py-1 active:opacity-70">
                    <Text style={{ color: colors.textMuted }} className="text-[12px] font-semibold">
                      Ləğv et
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Text Input Area */}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={
                cfg.descriptionPlaceholder ||
                `${cfg.singular} haqqında qeydləri bura yazın...`
              }
              placeholderTextColor={colors.textLight}
              multiline
              style={{
                minHeight: 65,
                maxHeight: 140,
                color: colors.text,
                textAlignVertical: 'top',
              }}
              className="py-1 text-[15px] leading-6"
            />

            {/* Attached Files Strip */}
            {files.length > 0 && (
              <View className="my-2 flex-row flex-wrap gap-2">
                {files.map((file, idx) => (
                  <View
                    key={idx}
                    style={{
                      backgroundColor: isDark ? '#1E293B' : '#EFF6FF',
                      borderColor: isDark ? '#334155' : '#BFDBFE',
                    }}
                    className="flex-row items-center rounded-xl border px-2.5 py-1.5">
                    <Text
                      style={{ color: colors.text }}
                      className="mr-2 text-[12px] font-medium"
                      numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Pressable onPress={() => removeFile(idx)} hitSlop={8}>
                      <X size={14} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Action Toolbar */}
            <View
              style={{ borderColor: colors.border }}
              className="mt-2 flex-row items-center justify-between border-t pt-2.5">
              {/* Attachment buttons */}
              <View className="flex-row items-center gap-2 flex-wrap">
                {cfg.sources.includes('camera') && (
                  <Pressable
                    onPress={() => handleSource('camera')}
                    hitSlop={6}
                    style={{ backgroundColor: colors.field, borderColor: colors.border }}
                    className="h-8.5 flex-row items-center rounded-xl border px-2.5 active:opacity-70">
                    <Camera size={15} color={colors.primary} />
                    <Text style={{ color: colors.text }} className="ml-1 text-[12px] font-medium">
                      Kamera
                    </Text>
                  </Pressable>
                )}

                {cfg.sources.includes('gallery') && (
                  <Pressable
                    onPress={() => handleSource('gallery')}
                    hitSlop={6}
                    style={{ backgroundColor: colors.field, borderColor: colors.border }}
                    className="h-8.5 flex-row items-center rounded-xl border px-2.5 active:opacity-70">
                    <ImageIcon size={15} color={colors.primary} />
                    <Text style={{ color: colors.text }} className="ml-1 text-[12px] font-medium">
                      Şəkil
                    </Text>
                  </Pressable>
                )}

                {cfg.sources.includes('voice') && (
                  <Pressable
                    onPress={() => setShowRecorder(true)}
                    hitSlop={6}
                    style={{
                      backgroundColor: isDark ? '#451A03' : '#FEF3C7',
                      borderColor: isDark ? '#78350F' : '#FCD34D',
                    }}
                    className="h-8.5 flex-row items-center rounded-xl border px-2.5 active:opacity-70">
                    <Mic size={15} color="#D97706" />
                    <Text className="ml-1 text-[12px] font-medium text-amber-800 dark:text-amber-300">
                      Səs
                    </Text>
                  </Pressable>
                )}

                {cfg.sources.includes('document') && (
                  <Pressable
                    onPress={() => handleSource('document')}
                    hitSlop={6}
                    style={{ backgroundColor: colors.field, borderColor: colors.border }}
                    className="h-8.5 flex-row items-center rounded-xl border px-2.5 active:opacity-70">
                    <FileUp size={15} color={colors.primary} />
                    <Text style={{ color: colors.text }} className="ml-1 text-[12px] font-medium">
                      Sənəd
                    </Text>
                  </Pressable>
                )}

                {cfg.hasDate && (
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    hitSlop={6}
                    style={{ backgroundColor: colors.field, borderColor: colors.border }}
                    className="h-8.5 flex-row items-center rounded-xl border px-2 active:opacity-70">
                    <CalendarIcon size={13} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted }} className="ml-1 text-[11px] font-medium">
                      {formatDate(date.toISOString(), language)}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Quick Commit button */}
              {(text.trim().length > 0 || files.length > 0) && (
                <Pressable
                  onPress={() => saveCurrentInput(false)}
                  hitSlop={6}
                  style={{ backgroundColor: colors.primary }}
                  className="h-8.5 flex-row items-center rounded-xl px-3 active:opacity-80 shadow-sm">
                  <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                  <Text className="ml-1 text-[12px] font-bold text-white">
                    {editingRecordId ? 'Yenilə' : 'Əlavə et'}
                  </Text>
                </Pressable>
              )}
            </View>
          </Card>

          {/* History Section Title */}
          <View className="mb-2 px-1 flex-row items-center justify-between">
            <Text style={{ color: colors.text }} className="text-[16px] font-bold">
              {`Tarixçə (${items?.length ?? 0})`}
            </Text>
            {(items?.length ?? 0) > 2 && (
              <Text style={{ color: colors.textMuted }} className="text-[12px]">
                Toxunaraq düzəliş edin
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Main List for History */}
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingTop: 2, paddingBottom: 40 }}
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
                  startEditingRecord(item);
                }
              }}
              onLongPress={() => {
                if (!selectionMode) {
                  enterSelectionMode(item.id);
                }
              }}
              onEdit={() => startEditingRecord(item)}
            />
          )}
          ListEmptyComponent={
            !selectionMode ? (
              <View className="items-center py-6 px-6">
                <Text style={{ color: colors.textMuted }} className="text-center text-[13px]">
                  {`Hələ ${cfg.singular.toLowerCase()} əlavə edilməyib.\nYuxarıdakı xanaya yazaraq ilk qeydinizi əlavə edin.`}
                </Text>
              </View>
            ) : undefined
          }
        />
      )}

      {/* Modals */}
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
