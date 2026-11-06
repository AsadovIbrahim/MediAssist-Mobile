import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  Edit3,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import { EmptyState, KeyboardLiftView, ScreenHeader, SearchBar } from '../components/ui';
import { AttachmentToolbar, AttachmentsView } from '../components/attachments';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import {
  childFolders,
  createFolder,
  deleteFolder,
  deleteFolders,
  getDescendantIds,
  loadFolders,
  moveFolder,
  renameFolder,
  setFolderFiles,
  setFolderText,
  subscribeFolders,
  type DoctorFolder,
} from '../features/folders';
import type { RootScreenProps } from '../navigation/types';

type NameDialog =
  | { mode: 'create'; parentId: string | null; parentName?: string }
  | { mode: 'rename'; folder: DoctorFolder }
  | null;

export function FolderScreen({ navigation, route }: RootScreenProps<'Folder'>) {
  const insets = useSafeAreaInsets();
  const folderId = route.params?.folderId ?? null;
  const { t } = useLanguage();
  const { colors, tints, isDark } = useTheme();

  const [all, setAll] = useState<DoctorFolder[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<NameDialog>(null);
  const [menuFolder, setMenuFolder] = useState<DoctorFolder | null>(null);
  const [movingFolder, setMovingFolder] = useState<DoctorFolder | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [noteText, setNoteText] = useState('');
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const noteTextRef = useRef('');
  const noteDirtyRef = useRef(false);
  const initializedNoteForIdRef = useRef<string | null>(null);

  // Load + keep in sync with other stacked folder screens
  useEffect(() => {
    let active = true;
    loadFolders(true).then(list => {
      if (!active) return;
      setAll([...list]);
    });
    const unsub = subscribeFolders(() => {
      loadFolders(false).then(list => {
        if (active) setAll([...list]);
      });
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const current = useMemo(
    () => (folderId ? all.find(f => f.id === folderId) ?? null : null),
    [all, folderId],
  );
  const children = useMemo(() => childFolders(all, folderId), [all, folderId]);
  const files = current?.files ?? [];

  // Initialize or sync folder note text when current folder loads
  useEffect(() => {
    if (!current) {
      return;
    }
    if (
      initializedNoteForIdRef.current !== current.id ||
      (!noteDirtyRef.current && (current.text ?? '') !== noteTextRef.current)
    ) {
      const next = current.text ?? '';
      initializedNoteForIdRef.current = current.id;
      noteTextRef.current = next;
      setNoteText(next);
    }
  }, [current?.id, current?.text]);

  // Debounced auto-save when typing inside a folder
  useEffect(() => {
    if (!folderId || !noteDirtyRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      noteDirtyRef.current = false;
      setFolderText(folderId, noteTextRef.current).catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [folderId, noteText]);

  // Flush pending folder text on screen exit / unmount
  useEffect(() => {
    if (!folderId) {
      return;
    }
    const flushNow = () => {
      if (noteDirtyRef.current) {
        noteDirtyRef.current = false;
        setFolderText(folderId, noteTextRef.current).catch(() => {});
      }
    };
    const unsubscribe = navigation.addListener('beforeRemove', flushNow);
    return () => {
      unsubscribe();
      flushNow();
    };
  }, [folderId, navigation]);

  const handleNoteChange = (val: string) => {
    setNoteText(val);
    noteTextRef.current = val;
    noteDirtyRef.current = true;
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openCreate = (targetParentId: string | null, parentName?: string) => {
    setNameInput('');
    setDialog({ mode: 'create', parentId: targetParentId, parentName });
  };

  const openFolderMenu = (folder: DoctorFolder) => {
    setMenuFolder(folder);
  };

  const confirmDeleteFolder = (folder: DoctorFolder) => {
    setMenuFolder(null);
    Alert.alert(
      t('folders.deleteConfirm'),
      t('folders.deleteConfirmDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteFolder(folder.id),
        },
      ],
      { cancelable: true },
    );
  };

  const submitDialog = async () => {
    if (!dialog) {
      return;
    }
    const trimmed = nameInput.trim();
    if (dialog.mode === 'create') {
      const siblings = childFolders(all, dialog.parentId);
      const defaultPrefix = dialog.parentId ? t('folders.newSubFolder') : t('folders.newFolder');
      const finalName = trimmed || `${defaultPrefix} ${siblings.length + 1}`;
      await createFolder(finalName, dialog.parentId);
      if (dialog.parentId) {
        setExpandedIds(prev => {
          const next = new Set(prev);
          next.add(dialog.parentId!);
          return next;
        });
      }
    } else {
      if (!trimmed) {
        return;
      }
      await renameFolder(dialog.folder.id, trimmed);
    }
    const updated = await loadFolders(false);
    setAll([...updated]);
    setDialog(null);
    setNameInput('');
  };

  const countLabel = (folder: DoctorFolder) => {
    const sub = all.filter(f => f.parentId === folder.id).length;
    const parts: string[] = [];
    if (sub) parts.push(`${sub} ${t('folders.foldersUnit')}`);
    if (folder.files.length) parts.push(`${folder.files.length} ${t('folders.filesUnit')}`);
    const firstLine = (folder.text ?? '').trim().split('\n')[0].trim();
    if (firstLine) {
      parts.push(firstLine);
    }
    return parts.length ? parts.join(' • ') : '';
  };

  const handleMoveTo = async (targetParentId: string | null) => {
    if (!movingFolder) {
      return;
    }
    const movingId = movingFolder.id;
    setMovingFolder(null);
    await moveFolder(movingId, targetParentId);
    if (targetParentId) {
      setExpandedIds(prev => {
        const next = new Set(prev);
        next.add(targetParentId);
        return next;
      });
    }
    const updated = await loadFolders(false);
    setAll([...updated]);
  };

  const moveCandidates = useMemo(() => {
    if (!movingFolder) {
      return [];
    }
    const forbidden = getDescendantIds(all, movingFolder.id);
    const result: Array<{ folder: DoctorFolder; depth: number }> = [];
    const walk = (pId: string | null, depth: number) => {
      for (const f of childFolders(all, pId)) {
        if (forbidden.has(f.id)) {
          continue;
        }
        result.push({ folder: f, depth });
        walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
    return result;
  }, [all, movingFolder]);

  // Compute visible tree set when searching
  const visibleNodeIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return null;
    }
    const byId = new Map(all.map(f => [f.id, f]));
    const allowed = new Set<string>();
    for (const f of all) {
      const matchName = f.name.toLowerCase().includes(q);
      const matchText = (f.text ?? '').toLowerCase().includes(q);
      if (matchName || matchText) {
        let curr: DoctorFolder | undefined = f;
        while (curr) {
          allowed.add(curr.id);
          curr = curr.parentId ? byId.get(curr.parentId) : undefined;
        }
      }
    }
    return allowed;
  }, [all, search]);

  // Collect all currently visible folder IDs under `folderId` for Select All
  const selectableIds = useMemo(() => {
    const result: string[] = [];
    const walk = (pId: string | null) => {
      const nodes = childFolders(all, pId).filter(
        f => !visibleNodeIds || visibleNodeIds.has(f.id),
      );
      for (const n of nodes) {
        result.push(n.id);
        const isExp = Boolean(visibleNodeIds) || expandedIds.has(n.id);
        if (isExp) {
          walk(n.id);
        }
      }
    };
    walk(folderId);
    return result;
  }, [all, folderId, visibleNodeIds, expandedIds]);

  const enterSelectionMode = (initialId?: string) => {
    setSelectionMode(true);
    setSelectedIds(initialId ? new Set([initialId]) : new Set());
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
    if (selectableIds.length === 0) return;
    if (selectedIds.size >= selectableIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      t('folders.deleteConfirm'),
      t('folders.deleteConfirmDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const ids = Array.from(selectedIds);
            exitSelectionMode();
            await deleteFolders(ids);
            const updated = await loadFolders(false);
            setAll([...updated]);
          },
        },
      ],
      { cancelable: true },
    );
  };

  // Recursive tree node renderer
  const renderTreeNodes = (parentId: string | null, depth = 0): React.ReactNode => {
    const nodes = childFolders(all, parentId).filter(
      f => !visibleNodeIds || visibleNodeIds.has(f.id),
    );
    if (nodes.length === 0) {
      return null;
    }

    return nodes.map((folder, idx) => {
      const subItems = childFolders(all, folder.id).filter(
        c => !visibleNodeIds || visibleNodeIds.has(c.id),
      );
      const hasSubItems = subItems.length > 0;
      const isExpanded = Boolean(visibleNodeIds) || expandedIds.has(folder.id);
      const isLast = idx === nodes.length - 1;
      const meta = countLabel(folder);
      const isSelected = selectedIds.has(folder.id);

      return (
        <View key={folder.id}>
          <View
            style={{ marginLeft: depth * 20 }}
            className="flex-row items-center">
            {/* Tree branch connector lines for nested levels */}
            {depth > 0 && (
              <View className="mr-1.5 h-12 w-3 items-center justify-center">
                <View
                  style={{
                    backgroundColor: isDark ? '#334155' : colors.border,
                    position: 'absolute',
                    left: 4,
                    top: 0,
                    bottom: isLast ? '50%' : 0,
                    width: 1.5,
                  }}
                />
                <View
                  style={{
                    backgroundColor: isDark ? '#334155' : colors.border,
                    position: 'absolute',
                    left: 4,
                    top: '50%',
                    right: 0,
                    height: 1.5,
                  }}
                />
              </View>
            )}

            <Pressable
              onPress={() => {
                if (selectionMode) {
                  toggleSelect(folder.id);
                } else {
                  navigation.push('Folder', { folderId: folder.id });
                }
              }}
              onLongPress={() => {
                if (selectionMode) {
                  toggleSelect(folder.id);
                } else {
                  openFolderMenu(folder);
                }
              }}
              delayLongPress={350}
              style={{
                backgroundColor:
                  selectionMode && isSelected
                    ? isDark
                      ? '#1E293B'
                      : '#EFF6FF'
                    : colors.surface,
                borderColor:
                  selectionMode && isSelected ? colors.primary : colors.border,
              }}
              className="mb-2 flex-1 flex-row items-center rounded-2xl border px-3 py-2.5 active:opacity-80">
              {/* Multi-select checkbox */}
              {selectionMode && (
                <View
                  style={{
                    borderColor: isSelected ? colors.primary : colors.textLight,
                    backgroundColor: isSelected ? colors.primary : 'transparent',
                  }}
                  className="mr-2.5 h-6 w-6 items-center justify-center rounded-full border-2">
                  {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                </View>
              )}

              {/* Expand / Collapse toggle or leaf indicator */}
              {hasSubItems ? (
                <Pressable
                  onPress={e => {
                    e.stopPropagation();
                    toggleExpand(folder.id);
                  }}
                  hitSlop={10}
                  style={{
                    backgroundColor: isDark ? '#1E293B' : colors.field,
                    borderColor: colors.border,
                  }}
                  className="mr-2.5 h-7 w-7 items-center justify-center rounded-lg border active:opacity-70">
                  {isExpanded ? (
                    <ChevronDown size={16} color={colors.primary} strokeWidth={2.5} />
                  ) : (
                    <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.5} />
                  )}
                </Pressable>
              ) : (
                <View className="mr-1.5 w-2" />
              )}

              {/* Folder / Item Icon */}
              <View
                style={{
                  backgroundColor: hasSubItems
                    ? isDark
                      ? tints.orange.tile
                      : tints.orange.bg
                    : isDark
                    ? tints.purple.tile
                    : tints.purple.bg,
                }}
                className="h-9 w-9 items-center justify-center rounded-xl">
                {hasSubItems ? (
                  isExpanded ? (
                    <FolderOpen size={19} color={tints.orange.fg} />
                  ) : (
                    <Folder size={19} color={tints.orange.fg} fill={tints.orange.fg} fillOpacity={0.2} />
                  )
                ) : (folder.files?.length ?? 0) > 0 || (folder.text ?? '').trim().length > 0 ? (
                  <FileText size={18} color={tints.purple.fg} />
                ) : (
                  <Folder size={18} color={tints.purple.fg} fill={tints.purple.fg} fillOpacity={0.2} />
                )}
              </View>

              {/* Folder Title & Meta */}
              <View className="ml-3 flex-1">
                <Text
                  style={{ color: colors.text }}
                  className="text-[15.5px] font-bold"
                  numberOfLines={1}>
                  {folder.name}
                </Text>
                {meta ? (
                  <Text
                    style={{ color: colors.textMuted }}
                    className="mt-0.5 text-[12px] font-medium"
                    numberOfLines={1}>
                    {meta}
                  </Text>
                ) : null}
              </View>

              {!selectionMode && (
                <>
                  {/* Quick "+ Add Sub-Item" button */}
                  <Pressable
                    onPress={e => {
                      e.stopPropagation();
                      openCreate(folder.id, folder.name);
                    }}
                    hitSlop={8}
                    accessibilityLabel={t('folders.newSubFolder')}
                    style={{ backgroundColor: isDark ? '#1E3A8A' : colors.primarySoft }}
                    className="mr-1.5 h-8 w-8 items-center justify-center rounded-lg active:opacity-70">
                    <Plus size={16} color={colors.primary} strokeWidth={2.5} />
                  </Pressable>

                  {/* More menu (Rename / Delete) */}
                  <Pressable
                    onPress={e => {
                      e.stopPropagation();
                      openFolderMenu(folder);
                    }}
                    hitSlop={8}
                    className="p-1 active:opacity-60">
                    <MoreHorizontal size={19} color={colors.textMuted} />
                  </Pressable>
                </>
              )}
            </Pressable>
          </View>

          {/* Nested Children */}
          {hasSubItems && isExpanded && renderTreeNodes(folder.id, depth + 1)}
        </View>
      );
    });
  };

  // Folder was deleted while open (e.g. from a parent screen)
  if (folderId && all.length > 0 && !current) {
    return (
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1">
        <ScreenHeader title={t('folders.title')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1">
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
              {selectedIds.size} {t('common.selected')}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={toggleSelectAll}
              hitSlop={10}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="h-10 items-center justify-center rounded-xl border px-3 active:opacity-70">
              <Text style={{ color: colors.primary }} className="text-[13px] font-semibold">
                {selectableIds.length > 0 && selectedIds.size >= selectableIds.length
                  ? t('common.deselectAll')
                  : t('common.selectAll')}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDeleteSelected}
              disabled={selectedIds.size === 0}
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
              <Trash2 size={16} color="#DC2626" />
              <Text className="ml-1.5 text-[13px] font-bold text-red-600">
                {t('common.delete')} ({selectedIds.size})
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScreenHeader
          title={current?.name ?? t('folders.title')}
          right={
            children.length > 0 || current ? (
              <View className="flex-row items-center gap-2">
                {children.length > 0 && (
                  <Pressable
                    onPress={() => enterSelectionMode()}
                    hitSlop={10}
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-70">
                    <CheckSquare size={20} color={colors.text} />
                  </Pressable>
                )}
                {current && (
                  <Pressable
                    onPress={() => openFolderMenu(current)}
                    hitSlop={10}
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-70">
                    <MoreHorizontal size={22} color={colors.text} />
                  </Pressable>
                )}
              </View>
            ) : undefined
          }
        />
      )}

      {/* Search bar on root Tree View */}
      {!current && all.length > 0 && (
        <SearchBar
          placeholder={t('folders.searchPlh')}
          value={search}
          onChangeText={setSearch}
        />
      )}

      <KeyboardLiftView fullBottom>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="flex-1 px-4"
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: 4,
            paddingBottom: current ? 32 : 110,
          }}>
          {/* Tree view of folders / sub-items */}
          {renderTreeNodes(folderId, 0)}

          {/* Inside a folder: Attachments + direct text editor */}
          {current ? (
            <View className={`flex-1 ${children.length ? 'mt-3' : ''} px-1`}>
              <AttachmentsView
                files={files}
                onRemove={uri => setFolderFiles(current.id, files.filter(f => f.uri !== uri))}
              />

              <TextInput
                multiline
                value={noteText}
                onChangeText={handleNoteChange}
                placeholder={t('notes.noteContentPlh')}
                placeholderTextColor={colors.textLight}
                textAlignVertical="top"
                scrollEnabled={false}
                autoCorrect
                style={{
                  color: colors.text,
                  fontSize: 16,
                  lineHeight: 25,
                  minHeight: 260,
                }}
                className="flex-1 font-normal"
              />
            </View>
          ) : (
            children.length === 0 && (
              <EmptyState
                icon={FolderOpen}
                title={t('folders.emptyTitle')}
                text={t('folders.emptyDesc')}
              />
            )
          )}
        </ScrollView>

        {/* Inside a folder: toolbar with "new sub-item" + attachment actions */}
        {current && !selectionMode && (
          <AttachmentToolbar
            leading={{
              icon: FolderPlus,
              label: t('folders.newSubFolder'),
              onPress: () => openCreate(current.id, current.name),
            }}
            onAdd={added => setFolderFiles(current.id, [...files, ...added])}
          />
        )}
      </KeyboardLiftView>

      {/* Root level: floating "New folder" button */}
      {!current && !selectionMode && (
        <Pressable
          onPress={() => openCreate(null)}
          accessibilityRole="button"
          accessibilityLabel={t('folders.newFolder')}
          style={{
            bottom: Math.max(insets.bottom, 20) + 32,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 6,
          }}
          className="absolute right-5 flex-row items-center rounded-full bg-primary px-5 py-3.5 active:opacity-90">
          <FolderPlus size={22} color="#ffffff" strokeWidth={2.4} />
          <Text className="ml-2.5 text-[16px] font-bold text-white">{t('folders.newFolder')}</Text>
        </Pressable>
      )}

      {/* Create / rename dialog */}
      <Modal
        visible={dialog !== null}
        transparent
        animationType="fade"
        onShow={() => {
          setTimeout(() => {
            inputRef.current?.focus();
          }, 80);
        }}
        onRequestClose={() => setDialog(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 items-center justify-center bg-black/60 px-8">
          <View style={{ backgroundColor: colors.surface }} className="w-full rounded-2xl p-5">
            <Text style={{ color: colors.text }} className="mb-1 text-lg font-bold">
              {dialog?.mode === 'rename'
                ? t('folders.rename')
                : dialog?.parentId
                ? t('folders.newSubFolder')
                : t('folders.newFolder')}
            </Text>
            {dialog?.mode === 'create' && dialog.parentName ? (
              <Text style={{ color: colors.textMuted }} className="mb-3 text-xs font-medium">
                {dialog.parentName}
              </Text>
            ) : (
              <View className="mb-2" />
            )}
            <TextInput
              ref={inputRef}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={t('folders.namePlh')}
              placeholderTextColor={colors.textLight}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitDialog}
              style={{ backgroundColor: colors.field, color: colors.text, borderColor: colors.border }}
              className="rounded-xl border px-3.5 py-3 text-base"
            />
            <View className="mt-4 flex-row justify-end gap-2">
              <Pressable onPress={() => setDialog(null)} className="rounded-xl px-4 py-2.5 active:opacity-70">
                <Text style={{ color: colors.textMuted }} className="text-[15px] font-semibold">
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={submitDialog}
                disabled={dialog?.mode === 'rename' && !nameInput.trim()}
                style={{ opacity: dialog?.mode === 'rename' && !nameInput.trim() ? 0.5 : 1 }}
                className="rounded-xl bg-primary px-5 py-2.5 active:opacity-80">
                <Text className="text-[15px] font-bold text-white">{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Folder Options Menu Modal (works identically on iOS & Android with Cancel) */}
      <Modal
        visible={menuFolder !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuFolder(null)}>
        <Pressable
          onPress={() => setMenuFolder(null)}
          className="flex-1 items-center justify-center bg-black/60 px-7">
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="w-full rounded-2xl border p-4 shadow-lg">
            {/* Header */}
            <View className="mb-3 flex-row items-center justify-between px-1">
              <Text
                style={{ color: colors.text }}
                className="flex-1 text-[17px] font-bold"
                numberOfLines={1}>
                {menuFolder?.name}
              </Text>
              <Pressable
                onPress={() => setMenuFolder(null)}
                hitSlop={10}
                style={{ backgroundColor: colors.field }}
                className="ml-2 h-8 w-8 items-center justify-center rounded-full active:opacity-70">
                <X size={17} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* New sub-item */}
            <Pressable
              onPress={() => {
                const target = menuFolder;
                setMenuFolder(null);
                if (target) {
                  openCreate(target.id, target.name);
                }
              }}
              style={{ backgroundColor: colors.field }}
              className="mb-2 flex-row items-center rounded-xl px-3.5 py-3 active:opacity-75">
              <FolderPlus size={19} color={colors.primary} />
              <Text style={{ color: colors.text }} className="ml-3 text-[15px] font-semibold">
                {t('folders.newSubFolder')}
              </Text>
            </Pressable>

            {/* Rename */}
            <Pressable
              onPress={() => {
                const target = menuFolder;
                setMenuFolder(null);
                if (target) {
                  setNameInput(target.name);
                  setDialog({ mode: 'rename', folder: target });
                }
              }}
              style={{ backgroundColor: colors.field }}
              className="mb-2 flex-row items-center rounded-xl px-3.5 py-3 active:opacity-75">
              <Edit3 size={19} color={colors.primary} />
              <Text style={{ color: colors.text }} className="ml-3 text-[15px] font-semibold">
                {t('folders.rename')}
              </Text>
            </Pressable>

            {/* Move to another folder */}
            {(all.length > 1 || menuFolder?.parentId !== null) && (
              <Pressable
                onPress={() => {
                  const target = menuFolder;
                  setMenuFolder(null);
                  if (target) {
                    setMovingFolder(target);
                  }
                }}
                style={{ backgroundColor: colors.field }}
                className="mb-2 flex-row items-center rounded-xl px-3.5 py-3 active:opacity-75">
                <CornerDownRight size={19} color={colors.primary} />
                <Text style={{ color: colors.text }} className="ml-3 text-[15px] font-semibold">
                  {t('folders.move')}
                </Text>
              </Pressable>
            )}

            {/* Delete */}
            <Pressable
              onPress={() => {
                if (menuFolder) {
                  confirmDeleteFolder(menuFolder);
                }
              }}
              style={{ backgroundColor: isDark ? '#450A0A' : colors.dangerSoft }}
              className="mb-3 flex-row items-center rounded-xl px-3.5 py-3 active:opacity-75">
              <Trash2 size={19} color={colors.danger} />
              <Text style={{ color: colors.danger }} className="ml-3 text-[15px] font-semibold">
                {t('common.delete')}
              </Text>
            </Pressable>

            {/* Cancel button */}
            <Pressable
              onPress={() => setMenuFolder(null)}
              style={{ borderColor: colors.border }}
              className="items-center justify-center rounded-xl border py-2.5 active:opacity-70">
              <Text style={{ color: colors.textMuted }} className="text-[15px] font-bold">
                {t('common.cancel')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Move Folder Destination Picker Modal */}
      <Modal
        visible={movingFolder !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMovingFolder(null)}>
        <Pressable
          onPress={() => setMovingFolder(null)}
          className="flex-1 items-center justify-center bg-black/60 px-6">
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{ backgroundColor: colors.surface, borderColor: colors.border, maxHeight: '75%' }}
            className="w-full rounded-2xl border p-4 shadow-lg">
            <View className="mb-3 flex-row items-center justify-between px-1">
              <View className="flex-1 pr-2">
                <Text style={{ color: colors.text }} className="text-[17px] font-bold" numberOfLines={1}>
                  {t('folders.moveTitle')}
                </Text>
                {movingFolder && (
                  <Text style={{ color: colors.textMuted }} className="mt-0.5 text-xs font-medium" numberOfLines={1}>
                    {movingFolder.name}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => setMovingFolder(null)}
                hitSlop={10}
                style={{ backgroundColor: colors.field }}
                className="h-8 w-8 items-center justify-center rounded-full active:opacity-70">
                <X size={17} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView className="mb-3" keyboardShouldPersistTaps="handled">
              {/* Option to move a nested folder back out to Root */}
              {movingFolder?.parentId !== null && (
                <Pressable
                  onPress={() => handleMoveTo(null)}
                  style={{ backgroundColor: colors.field, borderColor: colors.border }}
                  className="mb-2 flex-row items-center rounded-xl border px-3.5 py-3 active:opacity-75">
                  <FolderOpen size={19} color={colors.primary} />
                  <Text style={{ color: colors.primary }} className="ml-3 text-[15px] font-bold">
                    {t('folders.moveToRoot')}
                  </Text>
                </Pressable>
              )}

              {moveCandidates
                .filter(c => c.folder.id !== movingFolder?.parentId)
                .map(({ folder: target, depth }) => (
                  <Pressable
                    key={target.id}
                    onPress={() => handleMoveTo(target.id)}
                    style={{
                      backgroundColor: colors.field,
                      marginLeft: depth * 14,
                    }}
                    className="mb-2 flex-row items-center rounded-xl px-3.5 py-3 active:opacity-75">
                    <Folder size={19} color={tints.orange.fg} fill={tints.orange.fg} fillOpacity={0.2} />
                    <Text
                      style={{ color: colors.text }}
                      className="ml-3 flex-1 text-[15px] font-semibold"
                      numberOfLines={1}>
                      {target.name}
                    </Text>
                    <ChevronRight size={17} color={colors.textLight} />
                  </Pressable>
                ))}
            </ScrollView>

            <Pressable
              onPress={() => setMovingFolder(null)}
              style={{ borderColor: colors.border }}
              className="items-center justify-center rounded-xl border py-2.5 active:opacity-70">
              <Text style={{ color: colors.textMuted }} className="text-[15px] font-bold">
                {t('common.cancel')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
