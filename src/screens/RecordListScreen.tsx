import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Save,
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

/**
 * Deduplicates paragraphs and consecutive identical lines in a text note.
 */
export function deduplicateText(rawText: string): string {
  if (!rawText) return '';

  // 1. Split into lines and filter out consecutive identical non-empty lines
  const lines = rawText.split('\n');
  const nonDupLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = nonDupLines[nonDupLines.length - 1];
    if (line.trim().length > 0 && prev !== undefined && line.trim() === prev.trim()) {
      continue;
    }
    nonDupLines.push(line);
  }

  // 2. Split into paragraphs (separated by 1 or more blank lines) and remove duplicate paragraphs
  const paragraphs = nonDupLines
    .join('\n')
    .trim()
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const uniqueParas: string[] = [];
  for (const p of paragraphs) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueParas.push(p);
    }
  }

  return uniqueParas.join('\n\n');
}

/**
 * Merges unique paragraphs across multiple text records without duplicating content.
 */
export function getConsolidatedText(textRecords: any[]): string {
  if (!textRecords || textRecords.length === 0) return '';
  const seen = new Set<string>();
  const uniqueParas: string[] = [];

  for (const rec of textRecords) {
    const raw = (rec.description ?? rec.title ?? '').trim();
    const clean = deduplicateText(raw);
    if (!clean) continue;
    const paras = clean.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    for (const p of paras) {
      const key = p.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueParas.push(p);
      }
    }
  }

  return uniqueParas.join('\n\n');
}

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
  const [existingFiles, setExistingFiles] = useState<FileItem[]>([]);
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
  const existingFilesRef = useRef(existingFiles);
  existingFilesRef.current = existingFiles;
  const dateRef = useRef(date);
  dateRef.current = date;
  const editingRecordIdRef = useRef(editingRecordId);
  editingRecordIdRef.current = editingRecordId;
  const isSavingRef = useRef(false);
  const initialEditStateRef = useRef<{
    id: string;
    text: string;
    existingFilesCount: number;
  } | null>(null);

  // Track if user is currently inspecting a separate history item from the list below
  const [isEditingHistoryItem, setIsEditingHistoryItem] = useState(false);

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

  // Edit existing record inline
  const startEditingRecord = (item: any, customText?: string) => {
    setEditingRecordId(item.id);
    editingRecordIdRef.current = item.id;
    setEditingTitle(item.title);
    const rawDesc =
      customText !== undefined
        ? customText
        : (item.description ?? item.title ?? '');
    const initialDesc = deduplicateText(rawDesc);
    setText(initialDesc);
    textRef.current = initialDesc;
    if (item.date) {
      setDate(new Date(item.date));
      dateRef.current = new Date(item.date);
    }
    const currentItemFiles: FileItem[] = item.files ?? [];
    setExistingFiles(currentItemFiles);
    existingFilesRef.current = currentItemFiles;
    setFiles([]);
    filesRef.current = [];
    initialEditStateRef.current = {
      id: item.id,
      text: initialDesc,
      existingFilesCount: currentItemFiles.length,
    };
  };

  const cancelEditing = () => {
    setIsEditingHistoryItem(false);
    setEditingRecordId(null);
    editingRecordIdRef.current = null;
    setEditingTitle('');
    setText('');
    textRef.current = '';
    setFiles([]);
    filesRef.current = [];
    setExistingFiles([]);
    existingFilesRef.current = [];
    setDate(new Date());
    dateRef.current = new Date();
    initialEditStateRef.current = null;
  };

  // Synchronize existingFiles with reloaded items when an active record is being edited
  useEffect(() => {
    if (!items || !editingRecordIdRef.current) return;
    const current = items.find(i => i.id === editingRecordIdRef.current);
    if (current && current.files) {
      setExistingFiles(current.files);
      existingFilesRef.current = current.files;
    }
  }, [items]);

  // History list contains all saved records (both written text and media attachments)
  const historyItems = useMemo(() => {
    return items ?? [];
  }, [items]);

  // Core save function: saves written text and/or files into the list below and clears composer
  const saveCurrentInput = async (isLeaving = false): Promise<boolean> => {
    const trimmed = textRef.current.trim();
    const currentFiles = filesRef.current;
    const textRecordId = editingRecordIdRef.current;

    // If currently editing an existing history item from the list below
    if (isEditingHistoryItem && textRecordId) {
      if (!trimmed && currentFiles.length === 0 && existingFilesRef.current.length === 0) {
        try {
          await cfg.api.remove(textRecordId);
        } catch {}
        cancelEditing();
        await reload();
        return true;
      }

      isSavingRef.current = true;
      setAutoSaveStatus('saving');
      try {
        const cleanText = trimmed ? deduplicateText(trimmed) : '';
        const firstLine = cleanText ? cleanText.split('\n')[0].trim() : '';
        const nextTitle =
          existingFilesRef.current.length === 0 && currentFiles.length === 0 && firstLine
            ? firstLine.length > 50
              ? `${firstLine.slice(0, 47)}...`
              : firstLine
            : editingTitle || firstLine || `${cfg.singular} faylı`;

        let targetId = textRecordId;
        try {
          await cfg.api.update(
            textRecordId,
            {
              patientId: patient!.id,
              title: nextTitle,
              description: cleanText || null,
              kind: cfg.defaultKind,
              date: toApiDate(dateRef.current),
            },
            currentFiles,
          );
        } catch (updateErr: any) {
          if (updateErr?.status === 404) {
            const recreated = await cfg.api.create(
              {
                patientId: patient!.id,
                title: nextTitle,
                description: cleanText || null,
                kind: cfg.defaultKind,
                date: toApiDate(dateRef.current),
              },
              currentFiles,
            );
            targetId = recreated.id;
          } else {
            throw updateErr;
          }
        }
        if (!targetId.startsWith('local_') && currentFiles.length > 0) {
          for (const f of currentFiles) {
            try {
              await cfg.api.upload(targetId, f);
            } catch {}
          }
        }
        setAutoSaveStatus(null);
        cancelEditing();
        Keyboard.dismiss();
        await reload();
        refreshPatients().catch(() => {});
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
    }

    // Creating a new record (text and/or files): drops down into the list below!
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
      // 1. If files are attached, save the attachment record
      if (currentFiles.length > 0) {
        const hasAudio = currentFiles.some(f => f.kind === 'audio');
        const hasImage = currentFiles.some(f => f.kind === 'image');
        const fileKind = hasAudio ? 'Voice' : hasImage ? 'Image' : 'Document';
        const fileTitle = hasAudio
          ? `${cfg.singular} ${t('record.voiceSuffix') || 'səs qeydi'}`
          : hasImage
          ? `${cfg.singular} ${t('record.fileSuffix') || 'şəkli'}`
          : `${cfg.singular} sənədi`;

        const createdFileRecord = await cfg.api.create(
          {
            patientId: patient.id,
            title: fileTitle,
            description: null,
            kind: fileKind,
            date: toApiDate(dateRef.current),
          },
          currentFiles,
        );

        if (!createdFileRecord.id.startsWith('local_')) {
          for (const file of currentFiles) {
            try {
              await cfg.api.upload(createdFileRecord.id, file);
            } catch (err) {
              console.warn('Failed to upload file for attachment record:', err);
            }
          }
        }
      }

      // 2. If text is written, save it as a record in the list below!
      if (trimmed.length > 0) {
        const cleanText = deduplicateText(trimmed);
        const firstLine = cleanText.split('\n')[0].trim();
        const textTitle =
          firstLine.length > 50 ? `${firstLine.slice(0, 47)}...` : firstLine;

        await cfg.api.create({
          patientId: patient.id,
          title: textTitle,
          description: cleanText,
          kind: cfg.defaultKind,
          date: toApiDate(new Date()),
        });
      }

      setAutoSaveStatus(null);
      cancelEditing();
      Keyboard.dismiss();
      await reload();
      refreshPatients().catch(() => {});
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
      if (isSavingRef.current) {
        return;
      }

      const trimmed = textRef.current.trim();
      const currentFiles = filesRef.current;
      const isEditing = !!editingRecordIdRef.current;

      if (!isEditing) {
        // Creating new record: only save if user entered text or files
        if (!trimmed && currentFiles.length === 0) {
          return;
        }
      } else {
        // Editing existing record: ONLY save if user made actual changes!
        const init = initialEditStateRef.current;
        const cleanTrimmed = deduplicateText(trimmed);
        const cleanInitText = deduplicateText(init?.text ?? '');
        const hasTextChanged = init ? cleanTrimmed !== cleanInitText : false;
        const hasNewFiles = currentFiles.length > 0;
        const hasFilesRemoved = init
          ? existingFilesRef.current.length !== init.existingFilesCount
          : false;

        if (!hasTextChanged && !hasNewFiles && !hasFilesRemoved) {
          // No changes made! Don't re-save or overwrite anything.
          return;
        }
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

  const removeExistingFile = (file: FileItem) => {
    const recId = editingRecordIdRef.current;
    if (!recId) return;

    Alert.alert(
      t('record.deleteFileTitle') || 'Faylı sil',
      'Bu faylı silmək istədiyinizə əminsiniz?',
      [
        { text: t('common.cancel') || 'Ləğv et', style: 'cancel' },
        {
          text: t('common.delete') || 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!recId.startsWith('local_')) {
                await cfg.api.removeFile(recId, file.id);
              }
              const next = existingFilesRef.current.filter(f => f.id !== file.id);
              setExistingFiles(next);
              existingFilesRef.current = next;
              await refreshPatients();
              await reload();
            } catch (err: any) {
              Alert.alert(t('common.error'), err?.message || 'Fayl silinmədi');
            }
          },
        },
      ],
    );
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
    if (!historyItems || historyItems.length === 0) return;
    if (selectedIds.size === historyItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(historyItems.map(i => i.id)));
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
                {selectedIds.size === (historyItems?.length ?? 0)
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
          {(historyItems?.length ?? 0) > 0 && (
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
          <Card className="mb-3 p-3.5 shadow-sm">
            {/* Input Area with Integrated Top-Right Action Controls */}
            <View className="relative">
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={
                  cfg.descriptionPlaceholder ||
                  `${cfg.singular} haqqında qeydləri bura yazın...`
                }
                placeholderTextColor={colors.textLight}
                multiline
                scrollEnabled={true}
                style={{
                  minHeight: 75,
                  maxHeight: 180,
                  color: colors.text,
                  textAlignVertical: 'top',
                  paddingTop: 2,
                  paddingBottom: 4,
                  paddingLeft: 0,
                  paddingRight:
                    text.trim().length > 0 ||
                    files.length > 0 ||
                    isEditingHistoryItem
                      ? 42
                      : 4,
                }}
                className="text-[15px] leading-6"
              />

              {/* Floating top-right action buttons */}
              <View className="absolute top-0 right-0 flex-row items-center gap-2">
                {autoSaveStatus === 'saving' && (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={{ transform: [{ scale: 0.7 }] }}
                  />
                )}

                {/* Cancel button: ONLY when inspecting/editing a separate media record from the list */}
                {isEditingHistoryItem && (
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

                {/* Save Icon Button: Show whenever there is content */}
                {(text.trim().length > 0 || files.length > 0 || (isEditingHistoryItem && existingFiles.length > 0)) && (
                  <Pressable
                    onPress={() => saveCurrentInput(false)}
                    hitSlop={8}
                    accessibilityLabel="Yadda saxla"
                    style={{ backgroundColor: colors.primary }}
                    className="h-7 w-7 items-center justify-center rounded-lg active:opacity-80 shadow-sm">
                    <Save size={15} color="#FFFFFF" strokeWidth={2.2} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Attached Files Strip */}
            {((isEditingHistoryItem && existingFiles.length > 0) || files.length > 0) && (
              <View className="my-2 flex-row flex-wrap gap-2">
                {/* Existing uploaded files on record (when inspecting a history card) */}
                {isEditingHistoryItem && existingFiles.map(file => (
                  <View
                    key={file.id}
                    style={{
                      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                      borderColor: isDark ? '#334155' : '#CBD5E1',
                    }}
                    className="flex-row items-center rounded-xl border px-2.5 py-1.5">
                    {file.type === 'Image' ? (
                      <ImageIcon size={13} color={colors.primary} />
                    ) : file.type === 'VoiceRecording' ? (
                      <Mic size={13} color="#D97706" />
                    ) : (
                      <FileText size={13} color={colors.primary} />
                    )}
                    <Text
                      style={{ color: colors.text }}
                      className="mx-1.5 text-[12px] font-medium"
                      numberOfLines={1}>
                      {file.fileName}
                    </Text>
                    <Pressable onPress={() => removeExistingFile(file)} hitSlop={8}>
                      <X size={14} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}

                {/* Newly added files */}
                {files.map((file, idx) => (
                  <View
                    key={idx}
                    style={{
                      backgroundColor: isDark ? '#1E293B' : '#EFF6FF',
                      borderColor: isDark ? '#334155' : '#BFDBFE',
                    }}
                    className="flex-row items-center rounded-xl border px-2.5 py-1.5">
                    {file.kind === 'image' ? (
                      <ImageIcon size={13} color={colors.primary} />
                    ) : file.kind === 'audio' ? (
                      <Mic size={13} color="#D97706" />
                    ) : (
                      <FileUp size={13} color={colors.primary} />
                    )}
                    <Text
                      style={{ color: colors.text }}
                      className="mx-1.5 text-[12px] font-medium"
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
              </View>
            </View>
          </Card>

          {/* History Section Title (only if there are media/attachment items) */}
          {historyItems.length > 0 && (
            <View className="mb-2 px-1 flex-row items-center justify-between">
              <Text style={{ color: colors.text }} className="text-[16px] font-bold">
                {`Fayllar və tarixçə (${historyItems.length})`}
              </Text>
              {historyItems.length > 2 && (
                <Text style={{ color: colors.textMuted }} className="text-[12px]">
                  Toxunaraq düzəliş edin
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Main List for History (Media and file attachments) */}
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={historyItems}
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
                  setIsEditingHistoryItem(true);
                  startEditingRecord(item);
                }
              }}
              onLongPress={() => {
                if (!selectionMode) {
                  enterSelectionMode(item.id);
                }
              }}
              onEdit={() => {
                setIsEditingHistoryItem(true);
                startEditingRecord(item);
              }}
            />
          )}
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
