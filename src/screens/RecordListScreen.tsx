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

  // Track whether auto-load of existing written record has been performed
  const hasAutoLoadedRef = useRef(false);

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
    const initialDesc =
      customText !== undefined
        ? customText
        : (item.description ?? item.title ?? '');
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
    // If there is an existing primary text record, return to it instead of wiping blank
    const textRecords = (items ?? []).filter(i => !i.files || i.files.length === 0);
    if (textRecords.length > 0) {
      const primary = textRecords[0];
      const combinedText =
        textRecords.length > 1
          ? [...textRecords]
              .reverse()
              .map(r => (r.description || r.title || '').trim())
              .filter(Boolean)
              .join('\n\n')
          : (primary.description ?? primary.title ?? '');
      startEditingRecord(primary, combinedText);
    } else {
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
    }
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

  // Auto-populate composer with the patient's existing written text record(s) on initial load
  useEffect(() => {
    if (loading || !items || hasAutoLoadedRef.current) return;
    // If user already started typing or is editing, don't overwrite
    if (editingRecordIdRef.current || textRef.current.trim().length > 0) return;

    const textRecords = items.filter(i => !i.files || i.files.length === 0);
    if (textRecords.length > 0) {
      hasAutoLoadedRef.current = true;
      const primary = textRecords[0];
      const combinedText =
        textRecords.length > 1
          ? [...textRecords]
              .reverse()
              .map(r => (r.description || r.title || '').trim())
              .filter(Boolean)
              .join('\n\n')
          : (primary.description ?? primary.title ?? '');

      startEditingRecord(primary, combinedText);
    }
  }, [items, loading]);

  // Check if currently editing the patient's ongoing written record
  const isPrimaryTextRecord = useMemo(() => {
    if (!editingRecordId || !items) return false;
    const textRecords = items.filter(i => !i.files || i.files.length === 0);
    return textRecords.length > 0 && textRecords[0].id === editingRecordId;
  }, [editingRecordId, items]);

  // History list only contains records with media attachments (photos, voice notes, documents),
  // as pure text records are consolidated directly inside the top composer.
  const historyItems = useMemo(() => {
    if (!items) return [];
    return items.filter(i => i.files && i.files.length > 0);
  }, [items]);

  // Core save function
  const saveCurrentInput = async (isLeaving = false): Promise<boolean> => {
    const trimmed = textRef.current.trim();
    const currentFiles = filesRef.current;
    const currentExistingFiles = existingFilesRef.current;
    const isEditing = !!editingRecordIdRef.current;
    const targetId = editingRecordIdRef.current;

    // Nothing to save
    if (!trimmed && currentFiles.length === 0 && currentExistingFiles.length === 0) {
      if (isEditing && targetId) {
        try {
          if (targetId.startsWith('local_')) {
            const q = await offlineStorage.getQueue();
            const match = q.find(x => x.recordId === targetId);
            if (match) await offlineStorage.dequeue(match.id);
          } else {
            await cfg.api.remove(targetId);
          }
          setEditingRecordId(null);
          editingRecordIdRef.current = null;
          setText('');
          textRef.current = '';
          initialEditStateRef.current = null;
          await refreshPatients();
          await reload();
        } catch {}
      }
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
      const hasAudio =
        currentFiles.some(f => f.kind === 'audio') ||
        currentExistingFiles.some(f => f.type === 'VoiceRecording');
      const hasImage =
        currentFiles.some(f => f.kind === 'image') ||
        currentExistingFiles.some(f => f.type === 'Image');
      const hasDoc =
        currentFiles.some(f => f.kind === 'document') ||
        currentExistingFiles.some(f => f.type === 'Document');

      const finalTitle =
        firstLine.length > 0
          ? firstLine.length > 50
            ? `${firstLine.slice(0, 47)}...`
            : firstLine
          : hasAudio
          ? `${cfg.singular} ${t('record.voiceSuffix')}`
          : currentFiles.length > 0 || currentExistingFiles.length > 0
          ? `${cfg.singular} ${t('record.fileSuffix')}`
          : `${cfg.singular} ${t('record.recordSuffix')}`;

      const targetKind = hasAudio
        ? 'Voice'
        : hasImage
        ? 'Image'
        : hasDoc
        ? 'Document'
        : cfg.defaultKind;

      const uploadedFiles: FileItem[] = [...currentExistingFiles];
      let savedRecordId = targetId;

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

        // Upload newly selected files
        if (!targetId.startsWith('local_') && currentFiles.length > 0) {
          for (const file of currentFiles) {
            try {
              const uploaded = await cfg.api.upload(targetId, file);
              if (uploaded) {
                uploadedFiles.push(uploaded);
              }
            } catch (err) {
              console.warn('Failed to upload file for updated record:', err);
            }
          }
        }
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
        savedRecordId = created.id;
        if (!created.id.startsWith('local_') && currentFiles.length > 0) {
          for (const file of currentFiles) {
            try {
              const uploaded = await cfg.api.upload(created.id, file);
              if (uploaded) {
                uploadedFiles.push(uploaded);
              }
            } catch (err) {
              console.warn('Failed to upload file for created record:', err);
            }
          }
        }
      }

      setAutoSaveStatus(null);

      if (!isLeaving) {
        if (savedRecordId) {
          setEditingRecordId(savedRecordId);
          editingRecordIdRef.current = savedRecordId;
          setEditingTitle(finalTitle);
          setExistingFiles(uploadedFiles);
          existingFilesRef.current = uploadedFiles;
          initialEditStateRef.current = {
            id: savedRecordId,
            text: trimmed,
            existingFilesCount: uploadedFiles.length,
          };
          hasAutoLoadedRef.current = true;
        }
        setFiles([]);
        filesRef.current = [];
        setIsEditingHistoryItem(false);
      }

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
        const hasTextChanged = init ? trimmed !== init.text.trim() : false;
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
                    ? cfg.singular
                    : `Yeni ${cfg.singular.toLowerCase()} yazın`}
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
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
                {(text.trim().length > 0 || files.length > 0 || existingFiles.length > 0) && (
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
              scrollEnabled={true}
              style={{
                minHeight: 85,
                maxHeight: 180,
                color: colors.text,
                textAlignVertical: 'top',
              }}
              className="py-1 text-[15px] leading-6"
            />

            {/* Attached Files Strip */}
            {(existingFiles.length > 0 || files.length > 0) && (
              <View className="my-2 flex-row flex-wrap gap-2">
                {/* Existing uploaded files on record */}
                {existingFiles.map(file => (
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

              {/* Quick Commit button (only shown when adding a new record) */}
              {!editingRecordId && (text.trim().length > 0 || files.length > 0) && (
                <Pressable
                  onPress={() => saveCurrentInput(false)}
                  hitSlop={6}
                  style={{ backgroundColor: colors.primary }}
                  className="h-8.5 flex-row items-center rounded-xl px-3 active:opacity-80 shadow-sm">
                  <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                  <Text className="ml-1 text-[12px] font-bold text-white">
                    Əlavə et
                  </Text>
                </Pressable>
              )}
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
