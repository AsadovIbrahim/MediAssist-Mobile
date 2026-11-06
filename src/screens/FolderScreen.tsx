import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  Edit3,
  Eraser,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Highlighter,
  MoreHorizontal,
  Palette,
  PenTool,
  Plus,
  Redo2,
  Trash2,
  Type,
  Undo2,
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
  setFolderDrawing,
  setFolderFiles,
  setFolderText,
  subscribeFolders,
  type DoctorFolder,
  type FolderDrawingStroke,
  type FolderPaperStyle,
} from '../features/folders';
import {
  BRUSH_SIZES,
  CANVAS_HEIGHT,
  CUSTOM_COLORS_KEY,
  CustomColorPickerModal,
  DRAW_COLORS,
  PaperBackground,
  pointsToSvgPath,
  type DrawTool,
} from './NotesScreen';
import type { RootScreenProps } from '../navigation/types';

type NameDialog =
  | { mode: 'create'; parentId: string | null; parentName?: string }
  | { mode: 'rename'; folder: DoctorFolder }
  | null;

export function FolderScreen({ navigation, route }: RootScreenProps<'Folder'>) {
  const insets = useSafeAreaInsets();
  const folderId = route.params?.folderId ?? null;
  const { language, t } = useLanguage();
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

  // Interactive Drawing Studio state inside a leaf (purple) folder
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0]);
  const [brushSize, setBrushSize] = useState<number>(BRUSH_SIZES[1].size);
  const [paperStyle, setPaperStyle] = useState<FolderPaperStyle>('grid');
  const [folderStrokes, setFolderStrokes] = useState<FolderDrawingStroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<FolderDrawingStroke[]>([]);
  const [liveStroke, setLiveStroke] = useState<FolderDrawingStroke | null>(null);
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const pointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const drawToolRef = useRef<DrawTool>(drawTool);
  drawToolRef.current = drawTool;
  const drawColorRef = useRef<string>(drawColor);
  drawColorRef.current = drawColor;
  const brushSizeRef = useRef<number>(brushSize);
  brushSizeRef.current = brushSize;
  const isDarkRef = useRef<boolean>(isDark);
  isDarkRef.current = isDark;
  const folderStrokesRef = useRef<FolderDrawingStroke[]>(folderStrokes);
  folderStrokesRef.current = folderStrokes;
  const paperStyleRef = useRef<FolderPaperStyle>(paperStyle);
  paperStyleRef.current = paperStyle;
  const initializedDrawingForIdRef = useRef<string | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const canvasWidth = Math.max(280, screenWidth - 32);

  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_COLORS_KEY)
      .then(raw => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setCustomColors(parsed);
        }
      })
      .catch(() => {});
  }, []);

  const allColors = useMemo(() => {
    const merged = [...customColors];
    for (const c of DRAW_COLORS) {
      if (!merged.some(m => m.toUpperCase() === c.toUpperCase())) {
        merged.push(c);
      }
    }
    return merged;
  }, [customColors]);

  const handleSelectCustomColor = (hex: string) => {
    const normalized = hex.toUpperCase();
    setDrawColor(normalized);
    if (drawTool === 'eraser') setDrawTool('pen');
    setCustomColors(prev => {
      const next = [normalized, ...prev.filter(c => c.toUpperCase() !== normalized)].slice(0, 8);
      AsyncStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    setColorPickerOpen(false);
  };

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
  const isLeafFolder = Boolean(current && children.length === 0);
  const files = current?.files ?? [];

  // Initialize or sync folder note text and drawing when current folder loads
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
    if (initializedDrawingForIdRef.current !== current.id) {
      initializedDrawingForIdRef.current = current.id;
      const initialStrokes = current.strokes ?? [];
      const initialPaper = current.paperStyle ?? 'grid';
      setFolderStrokes(initialStrokes);
      folderStrokesRef.current = initialStrokes;
      setPaperStyle(initialPaper);
      paperStyleRef.current = initialPaper;
      setRedoStrokes([]);
      setLiveStroke(null);
      setDrawingMode(false);
    }
  }, [current?.id, current?.text, current?.strokes, current?.paperStyle]);

  // If a leaf folder becomes a parent folder by adding a sub-folder, exit drawing mode
  useEffect(() => {
    if (!isLeafFolder && drawingMode) {
      setDrawingMode(false);
    }
  }, [isLeafFolder, drawingMode]);

  const commitFolderDrawing = (
    nextStrokes: FolderDrawingStroke[],
    nextPaper: FolderPaperStyle = paperStyleRef.current,
  ) => {
    if (!folderId) return;
    setFolderStrokes(nextStrokes);
    folderStrokesRef.current = nextStrokes;
    setPaperStyle(nextPaper);
    paperStyleRef.current = nextPaper;
    setFolderDrawing(folderId, nextStrokes, nextPaper).catch(() => {});
  };

  // Interactive PanResponder for freehand SVG drawing inside a leaf folder
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: e => {
          const { locationX, locationY } = e.nativeEvent;
          pointsRef.current = [{ x: locationX, y: locationY }];
          const tool = drawToolRef.current;
          const strokeColor =
            tool === 'eraser'
              ? isDarkRef.current
                ? '#0B1324'
                : '#FFFFFF'
              : drawColorRef.current;
          const strokeWidth =
            tool === 'highlighter'
              ? brushSizeRef.current * 2.4
              : tool === 'eraser'
              ? brushSizeRef.current * 3.2
              : brushSizeRef.current;
          const opacity = tool === 'highlighter' ? 0.38 : 1;

          setLiveStroke({
            id: `live_${Date.now()}`,
            d: pointsToSvgPath(pointsRef.current),
            color: strokeColor,
            width: strokeWidth,
            opacity,
          });
        },
        onPanResponderMove: e => {
          const { locationX, locationY } = e.nativeEvent;
          pointsRef.current.push({ x: locationX, y: locationY });
          const d = pointsToSvgPath(pointsRef.current);
          setLiveStroke(prev => (prev ? { ...prev, d } : null));
        },
        onPanResponderRelease: () => {
          const pts = pointsRef.current;
          if (pts.length > 0) {
            const tool = drawToolRef.current;
            const strokeColor =
              tool === 'eraser'
                ? isDarkRef.current
                  ? '#0B1324'
                  : '#FFFFFF'
                : drawColorRef.current;
            const strokeWidth =
              tool === 'highlighter'
                ? brushSizeRef.current * 2.4
                : tool === 'eraser'
                ? brushSizeRef.current * 3.2
                : brushSizeRef.current;
            const opacity = tool === 'highlighter' ? 0.38 : 1;
            const finalStroke: FolderDrawingStroke = {
              id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              d: pointsToSvgPath(pts),
              color: strokeColor,
              width: strokeWidth,
              opacity,
            };
            const nextStrokes = [...folderStrokesRef.current, finalStroke];
            setRedoStrokes([]);
            commitFolderDrawing(nextStrokes, paperStyleRef.current);
          }
          pointsRef.current = [];
          setLiveStroke(null);
        },
        onPanResponderTerminate: () => {
          const pts = pointsRef.current;
          if (pts.length > 1) {
            const tool = drawToolRef.current;
            const strokeColor =
              tool === 'eraser'
                ? isDarkRef.current
                  ? '#0B1324'
                  : '#FFFFFF'
                : drawColorRef.current;
            const strokeWidth =
              tool === 'highlighter'
                ? brushSizeRef.current * 2.4
                : tool === 'eraser'
                ? brushSizeRef.current * 3.2
                : brushSizeRef.current;
            const opacity = tool === 'highlighter' ? 0.38 : 1;
            const finalStroke: FolderDrawingStroke = {
              id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              d: pointsToSvgPath(pts),
              color: strokeColor,
              width: strokeWidth,
              opacity,
            };
            const nextStrokes = [...folderStrokesRef.current, finalStroke];
            setRedoStrokes([]);
            commitFolderDrawing(nextStrokes, paperStyleRef.current);
          }
          pointsRef.current = [];
          setLiveStroke(null);
        },
      }),
    [folderId],
  );

  const handleUndoStroke = () => {
    if (folderStrokes.length === 0) return;
    const last = folderStrokes[folderStrokes.length - 1];
    const nextStrokes = folderStrokes.slice(0, -1);
    setRedoStrokes(r => [last, ...r]);
    commitFolderDrawing(nextStrokes, paperStyle);
  };

  const handleRedoStroke = () => {
    if (redoStrokes.length === 0) return;
    const [first, ...rest] = redoStrokes;
    const nextStrokes = [...folderStrokes, first];
    setRedoStrokes(rest);
    commitFolderDrawing(nextStrokes, paperStyle);
  };

  const handleClearCanvas = () => {
    if (folderStrokes.length === 0) return;
    Alert.alert(
      language === 'ru'
        ? 'Очистить рисунок?'
        : language === 'en'
        ? 'Clear drawing?'
        : 'Rəsmi təmizlə?',
      language === 'ru'
        ? 'Все штрихи на холсте будут удалены.'
        : language === 'en'
        ? 'All strokes on the canvas will be cleared.'
        : 'Lövhədəki bütün cizgilər silinəcək.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            setRedoStrokes([]);
            commitFolderDrawing([], paperStyle);
          },
        },
      ],
    );
  };

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

  const hasFolderContent = (f: DoctorFolder) =>
    (f.text ?? '').trim().length > 0 ||
    (f.files?.length ?? 0) > 0 ||
    (f.strokes?.length ?? 0) > 0;

  const currentHasContent = Boolean(
    current &&
      (noteText.trim().length > 0 ||
        files.length > 0 ||
        folderStrokes.length > 0 ||
        hasFolderContent(current)),
  );

  const countLabel = (folder: DoctorFolder) => {
    const sub = all.filter(f => f.parentId === folder.id).length;
    const parts: string[] = [];
    if (sub) parts.push(`${sub} ${t('folders.foldersUnit')}`);
    if (folder.files.length) parts.push(`${folder.files.length} ${t('folders.filesUnit')}`);
    if ((folder.strokes?.length ?? 0) > 0) {
      parts.push(language === 'ru' ? '🎨 Рисунок' : language === 'en' ? '🎨 Drawing' : '🎨 Rəsm');
    }
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
        // Documents (leaf items with note/file/drawing content) cannot contain sub-folders
        const fSubCount = childFolders(all, f.id).length;
        if (fSubCount === 0 && hasFolderContent(f)) {
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
                ) : (folder.files?.length ?? 0) > 0 ||
                  (folder.text ?? '').trim().length > 0 ||
                  (folder.strokes?.length ?? 0) > 0 ? (
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
                  {/* Quick "+ Add Sub-Item" button — hidden for documents (leaf items with content) */}
                  {(hasSubItems || !hasFolderContent(folder)) && (
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
                  )}

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
        {isLeafFolder && drawingMode ? (
          /* ---------------- INTERACTIVE DRAWING STUDIO INSIDE PURPLE LEAF FOLDER ---------------- */
          <View className="flex-1 px-4 pt-1">
            {/* Drawing Control Panel */}
            <View
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="mb-3 rounded-2xl border p-3">
              {/* Row 1: Tool Types + Undo/Redo/Clear */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Pressable
                    onPress={() => setDrawTool('pen')}
                    style={{
                      backgroundColor: drawTool === 'pen' ? colors.primary : colors.field,
                    }}
                    className="flex-row items-center rounded-xl px-3 py-2">
                    <PenTool size={15} color={drawTool === 'pen' ? '#fff' : colors.text} />
                    <Text
                      style={{ color: drawTool === 'pen' ? '#fff' : colors.text }}
                      className="ml-1.5 text-xs font-bold">
                      {language === 'ru' ? 'Ручка' : language === 'en' ? 'Pen' : 'Qələm'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setDrawTool('highlighter')}
                    style={{
                      backgroundColor: drawTool === 'highlighter' ? '#F59E0B' : colors.field,
                    }}
                    className="flex-row items-center rounded-xl px-3 py-2">
                    <Highlighter
                      size={15}
                      color={drawTool === 'highlighter' ? '#fff' : colors.text}
                    />
                    <Text
                      style={{ color: drawTool === 'highlighter' ? '#fff' : colors.text }}
                      className="ml-1.5 text-xs font-bold">
                      Marker
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setDrawTool('eraser')}
                    style={{
                      backgroundColor: drawTool === 'eraser' ? '#EF4444' : colors.field,
                    }}
                    className="flex-row items-center rounded-xl px-3 py-2">
                    <Eraser size={15} color={drawTool === 'eraser' ? '#fff' : colors.text} />
                    <Text
                      style={{ color: drawTool === 'eraser' ? '#fff' : colors.text }}
                      className="ml-1.5 text-xs font-bold">
                      {language === 'ru' ? 'Ластик' : language === 'en' ? 'Eraser' : 'Pozan'}
                    </Text>
                  </Pressable>
                </View>

                <View className="flex-row items-center gap-1.5">
                  <Pressable
                    onPress={handleUndoStroke}
                    disabled={folderStrokes.length === 0}
                    style={{
                      backgroundColor: colors.field,
                      opacity: folderStrokes.length === 0 ? 0.4 : 1,
                    }}
                    className="h-8 w-8 items-center justify-center rounded-lg">
                    <Undo2 size={16} color={colors.text} />
                  </Pressable>
                  <Pressable
                    onPress={handleRedoStroke}
                    disabled={redoStrokes.length === 0}
                    style={{
                      backgroundColor: colors.field,
                      opacity: redoStrokes.length === 0 ? 0.4 : 1,
                    }}
                    className="h-8 w-8 items-center justify-center rounded-lg">
                    <Redo2 size={16} color={colors.text} />
                  </Pressable>
                  <Pressable
                    onPress={handleClearCanvas}
                    disabled={folderStrokes.length === 0}
                    style={{
                      backgroundColor: isDark ? '#450A0A' : '#FEE2E2',
                      opacity: folderStrokes.length === 0 ? 0.4 : 1,
                    }}
                    className="h-8 w-8 items-center justify-center rounded-lg">
                    <Trash2 size={15} color="#EF4444" />
                  </Pressable>
                </View>
              </View>

              {/* Row 2: Color Swatches + Custom Color Picker Button */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-3"
                contentContainerStyle={{ gap: 10, alignItems: 'center' }}>
                <Pressable
                  onPress={() => setColorPickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Xüsusi rəng seç"
                  className="h-7 w-7 items-center justify-center overflow-hidden rounded-full">
                  <View className="absolute inset-0">
                    <Svg width={28} height={28} viewBox="0 0 28 28">
                      <Defs>
                        <LinearGradient id="folderRainbowBtn" x1="0%" y1="0%" x2="100%" y2="100%">
                          <Stop offset="0%" stopColor="#EF4444" />
                          <Stop offset="25%" stopColor="#F59E0B" />
                          <Stop offset="50%" stopColor="#10B981" />
                          <Stop offset="75%" stopColor="#3B82F6" />
                          <Stop offset="100%" stopColor="#EC4899" />
                        </LinearGradient>
                      </Defs>
                      <Circle cx={14} cy={14} r={14} fill="url(#folderRainbowBtn)" />
                    </Svg>
                  </View>
                  <View
                    style={{ backgroundColor: isDark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.65)' }}
                    className="h-5 w-5 items-center justify-center rounded-full">
                    <Plus size={13} color={isDark ? '#FFFFFF' : '#0F172A'} strokeWidth={3} />
                  </View>
                </Pressable>

                {allColors.map(c => {
                  const active = drawColor.toUpperCase() === c.toUpperCase() && drawTool !== 'eraser';
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        setDrawColor(c);
                        if (drawTool === 'eraser') setDrawTool('pen');
                      }}
                      style={{
                        backgroundColor: c,
                        borderColor: active ? colors.primary : isDark ? '#475569' : '#CBD5E1',
                        borderWidth: active ? 3 : 1.5,
                        transform: [{ scale: active ? 1.15 : 1 }],
                      }}
                      className="h-7 w-7 items-center justify-center rounded-full">
                      {active && (
                        <Check
                          size={14}
                          color={c === '#FFFFFF' || c === '#F59E0B' || c === '#FDE047' ? '#0F172A' : '#FFFFFF'}
                          strokeWidth={3}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Row 3: Brush Size */}
              <View
                className="mt-3 border-t pt-2.5"
                style={{ borderTopColor: colors.border }}>
                <View className="flex-row items-center gap-1.5">
                  {BRUSH_SIZES.map(b => {
                    const selected = brushSize === b.size;
                    return (
                      <Pressable
                        key={b.label}
                        onPress={() => setBrushSize(b.size)}
                        style={{
                          backgroundColor: selected ? colors.primarySoft : colors.field,
                          borderColor: selected ? colors.primary : 'transparent',
                          borderWidth: 1,
                        }}
                        className="flex-1 flex-row items-center justify-center rounded-xl py-1.5">
                        <View
                          style={{
                            width: Math.min(b.size + 3, 12),
                            height: Math.min(b.size + 3, 12),
                            borderRadius: 99,
                            backgroundColor: selected ? colors.primary : colors.textMuted,
                          }}
                        />
                        <Text
                          style={{ color: selected ? colors.primary : colors.textMuted }}
                          className="ml-1.5 text-[11px] font-semibold">
                          {b.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Row 4: Paper Background Style */}
                <View className="mt-2 flex-row items-center gap-1.5">
                  {(['grid', 'lined', 'dots', 'plain'] as FolderPaperStyle[]).map(ps => (
                    <Pressable
                      key={ps}
                      onPress={() => commitFolderDrawing(folderStrokes, ps)}
                      style={{
                        backgroundColor: paperStyle === ps ? colors.primary : colors.field,
                      }}
                      className="flex-1 items-center justify-center rounded-xl py-1.5">
                      <Text
                        style={{ color: paperStyle === ps ? '#fff' : colors.textMuted }}
                        className="text-[11px] font-bold uppercase">
                        {ps === 'grid'
                          ? 'Tor'
                          : ps === 'lined'
                          ? 'Xətt'
                          : ps === 'dots'
                          ? 'Nöqtə'
                          : 'Sadə'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Interactive SVG Drawing Canvas */}
            <View
              {...panResponder.panHandlers}
              style={{
                minHeight: 240,
                backgroundColor: isDark ? '#0B1324' : '#FFFFFF',
                borderColor: colors.primary,
                borderWidth: 1.5,
              }}
              className="mb-3 flex-1 overflow-hidden rounded-3xl shadow-sm">
              <View pointerEvents="none" className="flex-1">
                <Svg width="100%" height="100%">
                  <PaperBackground
                    width={canvasWidth}
                    height={CANVAS_HEIGHT * 2}
                    style={paperStyle}
                    isDark={isDark}
                  />
                  {folderStrokes.map(st => (
                    <Path
                      key={st.id}
                      d={st.d}
                      stroke={st.color}
                      strokeWidth={st.width}
                      strokeOpacity={st.opacity ?? 1}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))}
                  {liveStroke && (
                    <Path
                      d={liveStroke.d}
                      stroke={liveStroke.color}
                      strokeWidth={liveStroke.width}
                      strokeOpacity={liveStroke.opacity ?? 1}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  )}
                </Svg>
              </View>
            </View>
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            className="flex-1 px-4"
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: 4,
              paddingBottom: isLeafFolder ? 32 : 110,
            }}>
            {/* Tree view of folders / sub-items */}
            {renderTreeNodes(folderId, 0)}

            {/* ONLY inside a purple leaf folder (no sub-folders): Drawing + Attachments + Note Editor */}
            {isLeafFolder && current ? (
              <View className="flex-1 px-1">
                {folderStrokes.length > 0 && (
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      setDrawingMode(true);
                    }}
                    style={{
                      backgroundColor: isDark ? '#0B1324' : '#FFFFFF',
                      borderColor: colors.border,
                    }}
                    className="mb-4 overflow-hidden rounded-2xl border">
                    <View className="h-44 w-full">
                      <Svg
                        width="100%"
                        height="100%"
                        viewBox={`0 0 ${canvasWidth} ${CANVAS_HEIGHT}`}>
                        <PaperBackground
                          width={canvasWidth}
                          height={CANVAS_HEIGHT}
                          style={paperStyle}
                          isDark={isDark}
                        />
                        {folderStrokes.map(st => (
                          <Path
                            key={st.id}
                            d={st.d}
                            stroke={st.color}
                            strokeWidth={st.width}
                            strokeOpacity={st.opacity ?? 1}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        ))}
                      </Svg>
                    </View>
                    <View
                      style={{ backgroundColor: colors.surface, borderTopColor: colors.border }}
                      className="flex-row items-center justify-between border-t px-3.5 py-2">
                      <View className="flex-row items-center">
                        <Palette size={14} color={colors.primary} />
                        <Text
                          style={{ color: colors.textMuted }}
                          className="ml-1.5 text-xs font-medium">
                          {language === 'ru'
                            ? 'Нажмите, чтобы продолжить рисование'
                            : language === 'en'
                            ? 'Tap to continue drawing'
                            : 'Rəsmə davam etmək üçün toxunun'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={e => {
                          e.stopPropagation();
                          handleClearCanvas();
                        }}
                        hitSlop={8}>
                        <Trash2 size={15} color="#EF4444" />
                      </Pressable>
                    </View>
                  </Pressable>
                )}

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
              !current &&
              children.length === 0 && (
                <EmptyState
                  icon={FolderOpen}
                  title={t('folders.emptyTitle')}
                  text={t('folders.emptyDesc')}
                />
              )
            )}
          </ScrollView>
        )}

        {/* ONLY inside a purple leaf folder: bottom toolbar with drawing studio and attachment actions */}
        {isLeafFolder && current && !selectionMode && (
          <AttachmentToolbar
            leading={{
              icon: drawingMode ? Type : Palette,
              label: drawingMode
                ? language === 'ru'
                  ? 'Текст'
                  : language === 'en'
                  ? 'Text'
                  : 'Mətn'
                : language === 'ru'
                ? 'Рисунок'
                : language === 'en'
                ? 'Draw'
                : 'Rəsm çək',
              onPress: () => {
                Keyboard.dismiss();
                setDrawingMode(v => !v);
              },
            }}
            onAdd={added => setFolderFiles(current.id, [...files, ...added])}
          />
        )}
      </KeyboardLiftView>

      {/* Root level OR Parent folder (with sub-folders): floating "New folder / New sub-item" button */}
      {!isLeafFolder && !selectionMode && (
        <Pressable
          onPress={() => openCreate(current ? current.id : null, current?.name)}
          accessibilityRole="button"
          accessibilityLabel={current ? t('folders.newSubFolder') : t('folders.newFolder')}
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
          <Text className="ml-2.5 text-[16px] font-bold text-white">
            {current ? t('folders.newSubFolder') : t('folders.newFolder')}
          </Text>
        </Pressable>
      )}

      <CustomColorPickerModal
        visible={colorPickerOpen}
        initialColor={drawColor}
        isDark={isDark}
        colors={colors}
        language={language}
        onClose={() => setColorPickerOpen(false)}
        onSelect={handleSelectCustomColor}
      />

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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

            {/* New sub-item — only shown for parent folders or empty folders (not documents with content) */}
            {menuFolder &&
              (childFolders(all, menuFolder.id).length > 0 ||
                (!hasFolderContent(menuFolder) &&
                  (menuFolder.id !== current?.id || !currentHasContent))) && (
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
              )}

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

              {moveCandidates.map(({ folder: target, depth }) => {
                const isCurrentParent = target.id === movingFolder?.parentId;
                const targetHasChildren = childFolders(all, target.id).length > 0;
                const indent = Math.min(depth, 4) * 18;
                return (
                  <View key={target.id} style={{ paddingLeft: indent }} className="flex-row items-center">
                    {/* Tree guide line for nested levels */}
                    {depth > 0 && (
                      <View
                        style={{
                          position: 'absolute',
                          left: indent - 10,
                          top: 0,
                          bottom: 6,
                          width: 1.5,
                          backgroundColor: isDark ? '#334155' : colors.border,
                        }}
                      />
                    )}
                    <Pressable
                      onPress={() => {
                        if (!isCurrentParent) handleMoveTo(target.id);
                      }}
                      disabled={isCurrentParent}
                      style={{
                        backgroundColor: isCurrentParent
                          ? isDark
                            ? '#1E293B'
                            : colors.primarySoft
                          : colors.field,
                        borderColor: isCurrentParent ? colors.primary : 'transparent',
                        borderWidth: 1,
                        opacity: isCurrentParent ? 0.75 : 1,
                      }}
                      className="mb-1.5 flex-1 flex-row items-center rounded-xl px-3 py-2.5 active:opacity-75">
                      {targetHasChildren ? (
                        <Folder size={18} color={tints.orange.fg} fill={tints.orange.fg} fillOpacity={0.2} />
                      ) : (
                        <Folder size={18} color={tints.purple.fg} fill={tints.purple.fg} fillOpacity={0.2} />
                      )}
                      <Text
                        style={{ color: colors.text }}
                        className="ml-2.5 flex-1 text-[14.5px] font-semibold"
                        numberOfLines={1}>
                        {target.name}
                      </Text>
                      {isCurrentParent && (
                        <Text style={{ color: colors.primary }} className="ml-2 text-[11px] font-bold">
                          {language === 'ru'
                            ? 'Сейчас здесь'
                            : language === 'en'
                            ? 'Current'
                            : 'Hazırda burada'}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                );
              })}
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
