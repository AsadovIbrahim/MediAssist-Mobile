import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
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
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import {
  Check,
  CheckSquare,
  ChevronLeft,
  Eraser,
  FileText,
  Highlighter,
  Image as ImageIcon,
  Mic,
  Palette,
  PenTool,
  Plus,
  Redo2,
  Save,
  Search,
  SquarePen,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react-native';
import { EmptyState, KeyboardLiftView, SearchBar } from '../components/ui';
import { AttachmentToolbar, AttachmentsView } from '../components/attachments';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import type { LocalFile } from '../api/types';
import {
  deleteWorkspaceFileFromServer,
  isLocalFilePendingUpload,
  uploadWorkspaceFiles,
  workspaceServerStore,
} from '../features/doctorWorkspace';
import type { RootScreenProps } from '../navigation/types';

const STORAGE_KEY = 'mediassist.doctor.scratchpad';
export const CUSTOM_COLORS_KEY = 'mediassist.doctor.custom_colors';

export type PaperStyle = 'plain' | 'grid' | 'lined' | 'dots';
export type DrawTool = 'pen' | 'highlighter' | 'eraser';

export interface DrawingStroke {
  id: string;
  d: string;
  color: string;
  width: number;
  opacity?: number;
}

export interface DoctorNote {
  id: string;
  title: string;
  text: string;
  files: LocalFile[];
  strokes: DrawingStroke[];
  paperStyle?: PaperStyle;
  createdAt: string;
  updatedAt: number;
}

interface StoredNotesEnvelope {
  notes: DoctorNote[];
  updatedAt: number;
  dirty?: boolean;
  // Legacy single-note fields for backwards compatibility
  text?: string;
  files?: LocalFile[];
}

export const DRAW_COLORS = [
  '#3B82F6', // Electric Blue
  '#EF4444', // Crimson Red
  '#10B981', // Emerald Green
  '#F59E0B', // Amber Gold
  '#A855F7', // Neon Purple
  '#EC4899', // Hot Pink
  '#06B6D4', // Cyan
  '#F97316', // Vibrant Orange
  '#FFFFFF', // Pure White
  '#0F172A', // Deep Ink
];

const FIXED_PALETTE_ROWS = [
  ['#EF4444', '#F97316', '#F59E0B', '#FDE047', '#22C55E', '#10B981', '#06B6D4', '#3B82F6', '#1D4ED8'],
  ['#6366F1', '#8B5CF6', '#D946EF', '#EC4899', '#FCA5A5', '#78350F', '#94A3B8', '#FFFFFF', '#0F172A'],
];

const SHADE_STEPS: Array<{ s: number; v: number }> = [
  { s: 0.22, v: 1.0 },
  { s: 0.42, v: 1.0 },
  { s: 0.64, v: 0.99 },
  { s: 0.84, v: 0.98 },
  { s: 1.0, v: 0.96 },
  { s: 1.0, v: 0.8 },
  { s: 1.0, v: 0.64 },
  { s: 1.0, v: 0.48 },
  { s: 1.0, v: 0.32 },
];

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, (n + m) * 255)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return { h: 210, s: 0.8, v: 0.95 };
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

export const BRUSH_SIZES = [
  { label: 'İncə', size: 2.5 },
  { label: 'Orta', size: 5 },
  { label: 'Qalın', size: 9 },
  { label: 'Fırça', size: 16 },
];

export const CANVAS_HEIGHT = 400;

function formatShortMonthDay(isoOrMs: string | number): string {
  const d = new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

function formatTimeHM(isoOrMs: string | number): string {
  const d = new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

function normalizeNotesFromRaw(parsed: any): StoredNotesEnvelope {
  if (!parsed || typeof parsed !== 'object') {
    return { notes: [], updatedAt: 0, dirty: false };
  }

  // Modern multi-note format
  if (Array.isArray(parsed.notes)) {
    const notes: DoctorNote[] = parsed.notes.map((n: any, idx: number) => ({
      id: typeof n?.id === 'string' && n.id ? n.id : `note_${Date.now()}_${idx}`,
      title: typeof n?.title === 'string' ? n.title : '',
      text: typeof n?.text === 'string' ? n.text : '',
      files: Array.isArray(n?.files) ? n.files : [],
      strokes: Array.isArray(n?.strokes) ? n.strokes : [],
      paperStyle: n?.paperStyle || 'grid',
      createdAt:
        typeof n?.createdAt === 'string'
          ? n.createdAt
          : new Date(n?.updatedAt || Date.now()).toISOString(),
      updatedAt: typeof n?.updatedAt === 'number' ? n.updatedAt : Date.now(),
    }));
    return {
      notes,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      dirty: Boolean(parsed.dirty),
    };
  }

  // Legacy single-note format migration
  const legacyText = typeof parsed.text === 'string' ? parsed.text : '';
  const legacyFiles = Array.isArray(parsed.files) ? parsed.files : [];
  if (legacyText.trim().length > 0 || legacyFiles.length > 0) {
    const ts = typeof parsed.updatedAt === 'number' && parsed.updatedAt > 0 ? parsed.updatedAt : Date.now();
    const firstLine = legacyText.trim().split('\n')[0].trim();
    const migrated: DoctorNote = {
      id: `note_migrated_${ts}`,
      title: firstLine ? firstLine.slice(0, 40) : `Text note ${formatShortMonthDay(ts)}`,
      text: legacyText,
      files: legacyFiles,
      strokes: [],
      paperStyle: 'grid',
      createdAt: new Date(ts).toISOString(),
      updatedAt: ts,
    };
    return {
      notes: [migrated],
      updatedAt: ts,
      dirty: Boolean(parsed.dirty),
    };
  }

  return { notes: [], updatedAt: 0, dirty: false };
}

async function readLocalNotes(): Promise<StoredNotesEnvelope> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      if (raw.trim().startsWith('{')) {
        try {
          return normalizeNotesFromRaw(JSON.parse(raw));
        } catch {
          // fallback
        }
      }
      if (raw.trim().length > 0) {
        const now = Date.now();
        return {
          notes: [
            {
              id: `note_${now}`,
              title: `Text note ${formatShortMonthDay(now)}`,
              text: raw,
              files: [],
              strokes: [],
              paperStyle: 'grid',
              createdAt: new Date(now).toISOString(),
              updatedAt: now,
            },
          ],
          updatedAt: now,
          dirty: true,
        };
      }
    }
  } catch {}
  return { notes: [], updatedAt: 0, dirty: false };
}

export function pointsToSvgPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 0.5).toFixed(1)} ${(p.y + 0.5).toFixed(1)}`;
  }
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    d += ` Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

export function NotesScreen({ navigation }: RootScreenProps<'Notes'>) {
  const insets = useSafeAreaInsets();
  const { language, t } = useLanguage();
  const { colors, isDark } = useTheme();

  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [loaded, setLoaded] = useState(false);

  // List screen states
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Editor states (`activeNoteId === null` means we are on the "All notes" grid view)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isNewDraft, setIsNewDraft] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteFiles, setNoteFiles] = useState<LocalFile[]>([]);
  const [noteStrokes, setNoteStrokes] = useState<DrawingStroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<DrawingStroke[]>([]);
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('grid');

  // Drawing studio states
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1].size);
  const [liveStroke, setLiveStroke] = useState<DrawingStroke | null>(null);
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const allColors = useMemo(() => {
    const merged = [...DRAW_COLORS];
    for (const c of customColors) {
      if (!merged.some(m => m.toUpperCase() === c.toUpperCase())) {
        merged.unshift(c);
      }
    }
    return merged;
  }, [customColors]);

  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_COLORS_KEY)
      .then(raw => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setCustomColors(parsed.filter(c => typeof c === 'string'));
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectCustomColor = useCallback((hex: string) => {
    const normalized = hex.toUpperCase();
    setDrawColor(normalized);
    if (drawToolRef.current === 'eraser') {
      setDrawTool('pen');
    }
    setCustomColors(prev => {
      const next = [normalized, ...prev.filter(c => c.toUpperCase() !== normalized)].slice(0, 8);
      AsyncStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    setColorPickerOpen(false);
  }, []);

  const mountedRef = useRef(true);
  const stateRef = useRef<StoredNotesEnvelope>({
    notes: [],
    updatedAt: 0,
    dirty: false,
  });
  const syncingRef = useRef(false);
  const syncQueuedRef = useRef(false);

  // Refs for live drawing PanResponder & instant auto-save
  const pointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const drawToolRef = useRef<DrawTool>(drawTool);
  drawToolRef.current = drawTool;
  const drawColorRef = useRef(drawColor);
  drawColorRef.current = drawColor;
  const brushSizeRef = useRef(brushSize);
  brushSizeRef.current = brushSize;
  const noteStrokesRef = useRef<DrawingStroke[]>(noteStrokes);
  noteStrokesRef.current = noteStrokes;

  const activeNoteIdRef = useRef<string | null>(activeNoteId);
  activeNoteIdRef.current = activeNoteId;
  const isNewDraftRef = useRef<boolean>(isNewDraft);
  isNewDraftRef.current = isNewDraft;
  const noteTitleRef = useRef<string>(noteTitle);
  noteTitleRef.current = noteTitle;
  const noteTextRef = useRef<string>(noteText);
  noteTextRef.current = noteText;
  const noteFilesRef = useRef<LocalFile[]>(noteFiles);
  noteFilesRef.current = noteFiles;
  const paperStyleRef = useRef<PaperStyle>(paperStyle);
  paperStyleRef.current = paperStyle;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hasPendingNoteFiles = (list: DoctorNote[]) =>
    list.some(n => (n.files ?? []).some(isLocalFilePendingUpload));

  const pushToServer = useCallback(async () => {
    if (syncingRef.current) {
      syncQueuedRef.current = true;
      return;
    }
    syncingRef.current = true;
    try {
      const snapshot = stateRef.current;
      let anyUploaded = false;
      const uploadedByNoteId = new Map<string, LocalFile[]>();

      for (const note of snapshot.notes) {
        const { files: uploadedFiles, changed } = await uploadWorkspaceFiles(note.files ?? []);
        if (changed) {
          anyUploaded = true;
          uploadedByNoteId.set(note.id, uploadedFiles);
        }
      }

      const mergedNotes = stateRef.current.notes.map(note => {
        const uploadedFiles = uploadedByNoteId.get(note.id);
        if (!uploadedFiles) return note;
        const snapNote = snapshot.notes.find(s => s.id === note.id);
        const byOldUri = new Map<string, LocalFile>();
        (snapNote?.files ?? []).forEach((oldF, idx) => {
          if (uploadedFiles[idx]) {
            byOldUri.set(oldF.uri, uploadedFiles[idx]);
          }
        });
        return {
          ...note,
          files: (note.files ?? []).map(f => byOldUri.get(f.uri) ?? f),
        };
      });

      if (anyUploaded && mountedRef.current) {
        setNotes(mergedNotes);
      }

      const stillPending = hasPendingNoteFiles(mergedNotes);
      const updatedAt = stateRef.current.updatedAt || Date.now();

      const payloadToSave: StoredNotesEnvelope = {
        notes: mergedNotes,
        updatedAt,
        dirty: stillPending,
      };

      await workspaceServerStore.saveNotePayload(
        JSON.stringify({
          notes: payloadToSave.notes,
          updatedAt: payloadToSave.updatedAt,
        }),
      );

      stateRef.current = payloadToSave;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payloadToSave));
    } catch {
      // Offline; remains saved locally with dirty=true
    } finally {
      syncingRef.current = false;
      if (syncQueuedRef.current) {
        syncQueuedRef.current = false;
        pushToServer().catch(() => {});
      }
    }
  }, []);

  const persistNotes = useCallback(
    async (nextNotes: DoctorNote[]) => {
      const sorted = [...nextNotes].sort((a, b) => b.updatedAt - a.updatedAt);
      const nextEnv: StoredNotesEnvelope = {
        notes: sorted,
        updatedAt: Date.now(),
        dirty: true,
      };
      stateRef.current = nextEnv;
      setNotes(sorted);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextEnv)).catch(() => {});
      pushToServer().catch(() => {});
    },
    [pushToServer],
  );

  // Load saved notes on mount & sync with server
  useEffect(() => {
    (async () => {
      const local = await readLocalNotes();
      stateRef.current = local;
      if (mountedRef.current) {
        setNotes(local.notes);
        setLoaded(true);
      }

      try {
        const hasLocal = local.notes.length > 0;
        const needsUpload = local.dirty || hasPendingNoteFiles(local.notes);
        if (needsUpload) {
          await pushToServer();
          return;
        }

        const remoteRaw = await workspaceServerStore.loadNotePayload<any>();
        if (stateRef.current.dirty) return;

        if (remoteRaw) {
          const remote = normalizeNotesFromRaw(remoteRaw);
          const remoteTime = remote.updatedAt || 1;
          const localTime = local.updatedAt || 0;
          if (!hasLocal || remoteTime > localTime) {
            const nextEnv: StoredNotesEnvelope = {
              notes: remote.notes,
              updatedAt: remoteTime,
              dirty: false,
            };
            stateRef.current = nextEnv;
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextEnv));
            if (mountedRef.current) {
              setNotes(remote.notes);
            }
          }
        } else if (hasLocal) {
          await pushToServer();
        }
      } catch {
        // Offline; local data already displayed
      }
    })();
  }, [pushToServer]);

  // Open new note editor
  const openNewNote = (startWithDrawing = false) => {
    const now = Date.now();
    setActiveNoteId(`note_${now}_${Math.random().toString(36).slice(2, 7)}`);
    setIsNewDraft(true);
    setNoteTitle('');
    setNoteText('');
    setNoteFiles([]);
    setNoteStrokes([]);
    setRedoStrokes([]);
    setPaperStyle('grid');
    setDrawingMode(startWithDrawing);
    setDrawTool('pen');
  };

  // Open existing note in editor
  const openExistingNote = (note: DoctorNote) => {
    setActiveNoteId(note.id);
    setIsNewDraft(false);
    const firstLine = (note.text ?? '').trim().split('\n')[0].trim();
    const autoLineTitle = firstLine
      ? firstLine.length > 36
        ? `${firstLine.slice(0, 34)}...`
        : firstLine
      : '';
    const isDefaultAutoTitle =
      note.title === autoLineTitle ||
      /^(Mətn qeydi|Rəsm qeydi|Text note|Drawing note|Заметка|Рисунок)\s+\d{2}\/\d{2}$/.test(
        note.title,
      );
    setNoteTitle(isDefaultAutoTitle ? '' : note.title);
    setNoteText(note.text);
    setNoteFiles(note.files ?? []);
    setNoteStrokes(note.strokes ?? []);
    setRedoStrokes([]);
    setPaperStyle(note.paperStyle ?? 'grid');
    setDrawingMode(
      (note.strokes?.length ?? 0) > 0 && !note.text.trim() && (note.files?.length ?? 0) === 0,
    );
    setDrawTool('pen');
  };

  // Core helper that builds & saves the current editor note using live refs
  const commitActiveNote = useCallback(async () => {
    const currentId = activeNoteIdRef.current;
    if (!currentId) return;

    const currentTitle = noteTitleRef.current.trim();
    const currentText = noteTextRef.current;
    const trimmedText = currentText.trim();
    const currentFiles = noteFilesRef.current;
    const currentStrokes = noteStrokesRef.current;
    const currentPaper = paperStyleRef.current;

    const hasContent =
      currentTitle.length > 0 ||
      trimmedText.length > 0 ||
      currentFiles.length > 0 ||
      currentStrokes.length > 0;

    if (!hasContent) {
      if (!isNewDraftRef.current) {
        const remaining = stateRef.current.notes.filter(n => n.id !== currentId);
        await persistNotes(remaining);
      }
      return;
    }

    const now = Date.now();
    const existing = stateRef.current.notes.find(n => n.id === currentId);
    const firstLine = trimmedText.split('\n')[0].trim();
    const defaultPrefix =
      currentStrokes.length > 0 && !trimmedText
        ? language === 'ru'
          ? 'Рисунок'
          : language === 'en'
          ? 'Drawing note'
          : 'Rəsm qeydi'
        : language === 'ru'
        ? 'Заметка'
        : language === 'en'
        ? 'Text note'
        : 'Mətn qeydi';

    const resolvedTitle =
      currentTitle ||
      (firstLine ? (firstLine.length > 36 ? `${firstLine.slice(0, 34)}...` : firstLine) : '') ||
      `${defaultPrefix} ${formatShortMonthDay(now)}`;

    if (
      existing &&
      existing.title === resolvedTitle &&
      existing.text === currentText &&
      (existing.paperStyle ?? 'grid') === currentPaper &&
      JSON.stringify(existing.files ?? []) === JSON.stringify(currentFiles) &&
      JSON.stringify(existing.strokes ?? []) === JSON.stringify(currentStrokes)
    ) {
      return;
    }

    const savedNote: DoctorNote = {
      id: currentId,
      title: resolvedTitle,
      text: currentText,
      files: currentFiles,
      strokes: currentStrokes,
      paperStyle: currentPaper,
      createdAt: existing?.createdAt ?? new Date(now).toISOString(),
      updatedAt: now,
    };

    const others = stateRef.current.notes.filter(n => n.id !== currentId);
    await persistNotes([savedNote, ...others]);
  }, [language, persistNotes]);

  // Live auto-save while editing so changes are never lost even if user exits unexpectedly
  useEffect(() => {
    if (!activeNoteId) return;
    const timer = setTimeout(() => {
      commitActiveNote().catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [activeNoteId, noteTitle, noteText, noteFiles, noteStrokes, paperStyle, commitActiveNote]);

  // Save current note & return to All Notes grid
  const saveAndCloseEditor = useCallback(async () => {
    if (!activeNoteIdRef.current) return;
    Keyboard.dismiss();
    await commitActiveNote();
    activeNoteIdRef.current = null;
    setActiveNoteId(null);
    setDrawingMode(false);
  }, [commitActiveNote]);

  // Intercept Android Hardware Back & iOS/Android swipe-back while inside Note Editor
  useEffect(() => {
    const onHardwareBack = () => {
      if (activeNoteIdRef.current !== null) {
        saveAndCloseEditor().catch(() => {});
        return true;
      }
      if (selectionMode) {
        setSelectionMode(false);
        setSelectedIds(new Set());
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [saveAndCloseEditor, selectionMode]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (activeNoteIdRef.current !== null) {
        // Intercept back gesture: save note & return to "All notes" grid instead of leaving NotesScreen
        e.preventDefault();
        saveAndCloseEditor().catch(() => {});
      }
    });
    return unsubscribe;
  }, [navigation, saveAndCloseEditor]);

  // PanResponder for smooth freehand SVG drawing / erasing (iOS & Android safe)
  const finishCurrentStroke = useCallback(() => {
    if (drawToolRef.current === 'eraser') {
      return;
    }
    const pts = pointsRef.current;
    if (pts.length > 0) {
      const isHighlighter = drawToolRef.current === 'highlighter';
      const finished: DrawingStroke = {
        id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        d: pointsToSvgPath(pts),
        color: drawColorRef.current,
        width: isHighlighter ? Math.max(brushSizeRef.current * 2.2, 14) : brushSizeRef.current,
        opacity: isHighlighter ? 0.36 : 1,
      };
      setNoteStrokes(prev => [...prev, finished]);
      setRedoStrokes([]);
    }
    pointsRef.current = [];
    setLiveStroke(null);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: evt => {
          const { locationX, locationY } = evt.nativeEvent;
          if (drawToolRef.current === 'eraser') {
            // Erase strokes near touch point
            setNoteStrokes(prev =>
              prev.filter(s => {
                const match = /M\s*([\d.]+)\s+([\d.]+)/.exec(s.d);
                if (!match) return true;
                const sx = parseFloat(match[1]);
                const sy = parseFloat(match[2]);
                return Math.hypot(sx - locationX, sy - locationY) > 36;
              }),
            );
            return;
          }
          pointsRef.current = [{ x: locationX, y: locationY }];
          const isHighlighter = drawToolRef.current === 'highlighter';
          const stroke: DrawingStroke = {
            id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            d: pointsToSvgPath(pointsRef.current),
            color: drawColorRef.current,
            width: isHighlighter ? Math.max(brushSizeRef.current * 2.2, 14) : brushSizeRef.current,
            opacity: isHighlighter ? 0.36 : 1,
          };
          setLiveStroke(stroke);
        },
        onPanResponderMove: evt => {
          const { locationX, locationY } = evt.nativeEvent;
          if (drawToolRef.current === 'eraser') {
            setNoteStrokes(prev =>
              prev.filter(s => {
                // Check if any coordinate pair in path is within 28px of eraser
                const coords = s.d.match(/[\d.]+\s+[\d.]+/g);
                if (!coords) return true;
                for (let i = 0; i < coords.length; i += 2) {
                  const parts = coords[i].trim().split(/\s+/);
                  const px = parseFloat(parts[0]);
                  const py = parseFloat(parts[1]);
                  if (Math.hypot(px - locationX, py - locationY) < 28) {
                    return false;
                  }
                }
                return true;
              }),
            );
            return;
          }
          const pts = pointsRef.current;
          const last = pts[pts.length - 1];
          if (!last || Math.hypot(locationX - last.x, locationY - last.y) > 2) {
            pts.push({ x: locationX, y: locationY });
            const isHighlighter = drawToolRef.current === 'highlighter';
            setLiveStroke({
              id: 'live',
              d: pointsToSvgPath(pts),
              color: drawColorRef.current,
              width: isHighlighter ? Math.max(brushSizeRef.current * 2.2, 14) : brushSizeRef.current,
              opacity: isHighlighter ? 0.36 : 1,
            });
          }
        },
        onPanResponderRelease: finishCurrentStroke,
        onPanResponderTerminate: finishCurrentStroke,
      }),
    [finishCurrentStroke],
  );

  const handleUndoStroke = () => {
    setNoteStrokes(prev => {
      if (prev.length === 0) return prev;
      const popped = prev[prev.length - 1];
      setRedoStrokes(r => [...r, popped]);
      return prev.slice(0, -1);
    });
  };

  const handleRedoStroke = () => {
    setRedoStrokes(prev => {
      if (prev.length === 0) return prev;
      const restored = prev[prev.length - 1];
      setNoteStrokes(s => [...s, restored]);
      return prev.slice(0, -1);
    });
  };

  const handleClearCanvas = () => {
    if (noteStrokes.length === 0) return;
    Alert.alert(
      language === 'ru' ? 'Очистить рисунок?' : language === 'en' ? 'Clear drawing?' : 'Rəsm təmizlənsin?',
      language === 'ru'
        ? 'Все нарисованные линии будут удалены.'
        : language === 'en'
        ? 'All drawn strokes on this canvas will be cleared.'
        : 'Çəkilmiş bütün xətlər silinəcək.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            setRedoStrokes(noteStrokes);
            setNoteStrokes([]);
          },
        },
      ],
    );
  };

  // Multi-select handlers on All Notes view
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      n =>
        n.title.toLowerCase().includes(q) ||
        n.text.toLowerCase().includes(q),
    );
  }, [notes, search]);

  const toggleSelectAll = () => {
    if (filteredNotes.length === 0) return;
    if (selectedIds.size >= filteredNotes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotes.map(n => n.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      t('notes.deleteConfirm'),
      `${selectedIds.size} ${t('common.selected')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const toDelete = stateRef.current.notes.filter(n => selectedIds.has(n.id));
            const remaining = stateRef.current.notes.filter(n => !selectedIds.has(n.id));
            setSelectionMode(false);
            setSelectedIds(new Set());
            await persistNotes(remaining);
            for (const note of toDelete) {
              for (const f of note.files ?? []) {
                deleteWorkspaceFileFromServer(f).catch(() => {});
              }
            }
          },
        },
      ],
    );
  };

  // Group notes into Today / This week / Earlier (like Samsung Notes)
  const groupedSections = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;

    const today: DoctorNote[] = [];
    const thisWeek: DoctorNote[] = [];
    const earlier: DoctorNote[] = [];

    for (const n of filteredNotes) {
      const ts = n.updatedAt || new Date(n.createdAt).getTime();
      if (ts >= startOfToday) {
        today.push(n);
      } else if (ts >= startOfWeek) {
        thisWeek.push(n);
      } else {
        earlier.push(n);
      }
    }

    const sections: Array<{ label: string; items: DoctorNote[] }> = [];
    if (today.length > 0) {
      sections.push({
        label: language === 'ru' ? 'Сегодня' : language === 'en' ? 'Today' : 'Bu gün',
        items: today,
      });
    }
    if (thisWeek.length > 0) {
      sections.push({
        label: language === 'ru' ? 'На этой неделе' : language === 'en' ? 'This week' : 'Bu həftə',
        items: thisWeek,
      });
    }
    if (earlier.length > 0) {
      sections.push({
        label: language === 'ru' ? 'Ранее' : language === 'en' ? 'Earlier' : 'Daha əvvəl',
        items: earlier,
      });
    }
    return sections;
  }, [filteredNotes, language]);

  const screenWidth = Dimensions.get('window').width;
  const canvasWidth = screenWidth - 32;

  /* ============================================================================
   * VIEW 2: INDIVIDUAL NOTE EDITOR + DRAWING STUDIO
   * ============================================================================ */
  if (activeNoteId !== null) {
    return (
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1">
        {/* Editor Top Bar */}
        <View className="flex-row items-center justify-between px-4 pt-2 pb-2.5">
          <Pressable
            onPress={saveAndCloseEditor}
            hitSlop={12}
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="mr-2.5 h-11 w-11 items-center justify-center rounded-2xl border active:opacity-70">
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>

          <TextInput
            value={noteTitle}
            onChangeText={setNoteTitle}
            placeholder={t('notes.noteTitlePlh')}
            placeholderTextColor={colors.textLight}
            style={{ color: colors.text }}
            className="mr-2 flex-1 text-[18px] font-bold"
          />

          {/* Save Button */}
          <Pressable
            onPress={saveAndCloseEditor}
            hitSlop={8}
            style={{ backgroundColor: colors.primary }}
            className="h-11 w-11 items-center justify-center rounded-2xl active:opacity-85">
            <Save size={19} color="#FFFFFF" />
          </Pressable>
        </View>

        <KeyboardLiftView fullBottom>
          {drawingMode ? (
            /* ---------------- INTERACTIVE DRAWING STUDIO ---------------- */
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
                      disabled={noteStrokes.length === 0}
                      style={{
                        backgroundColor: colors.field,
                        opacity: noteStrokes.length === 0 ? 0.4 : 1,
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
                      disabled={noteStrokes.length === 0}
                      style={{
                        backgroundColor: isDark ? '#450A0A' : '#FEE2E2',
                        opacity: noteStrokes.length === 0 ? 0.4 : 1,
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
                  {/* Rainbow Custom Color Palette Button */}
                  <Pressable
                    onPress={() => setColorPickerOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Xüsusi rəng seç"
                    className="h-7 w-7 items-center justify-center overflow-hidden rounded-full">
                    <View className="absolute inset-0">
                      <Svg width={28} height={28} viewBox="0 0 28 28">
                        <Defs>
                          <LinearGradient id="rainbowBtn" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#EF4444" />
                            <Stop offset="25%" stopColor="#F59E0B" />
                            <Stop offset="50%" stopColor="#10B981" />
                            <Stop offset="75%" stopColor="#3B82F6" />
                            <Stop offset="100%" stopColor="#EC4899" />
                          </LinearGradient>
                        </Defs>
                        <Circle cx={14} cy={14} r={14} fill="url(#rainbowBtn)" />
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
                    {(['grid', 'lined', 'dots', 'plain'] as PaperStyle[]).map(ps => (
                      <Pressable
                        key={ps}
                        onPress={() => setPaperStyle(ps)}
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
                    {noteStrokes.map(st => (
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
            /* ---------------- TEXT & MEDIA NOTE EDITOR ---------------- */
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1 }}
              className="flex-1 px-5 pt-2 pb-8">
              {/* If this note has a drawing, show interactive preview card at top */}
              {noteStrokes.length > 0 && (
                <Pressable
                  onPress={() => setDrawingMode(true)}
                  style={{
                    backgroundColor: isDark ? '#0B1324' : '#FFFFFF',
                    borderColor: colors.border,
                  }}
                  className="mb-4 overflow-hidden rounded-2xl border">
                  <View className="h-44 w-full">
                    <Svg width="100%" height="100%" viewBox={`0 0 ${canvasWidth} ${CANVAS_HEIGHT}`}>
                      <PaperBackground
                        width={canvasWidth}
                        height={CANVAS_HEIGHT}
                        style={paperStyle}
                        isDark={isDark}
                      />
                      {noteStrokes.map(st => (
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
                      <Text style={{ color: colors.textMuted }} className="ml-1.5 text-xs font-medium">
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
                files={noteFiles}
                onRemove={uri => {
                  const removed = noteFiles.find(f => f.uri === uri);
                  setNoteFiles(prev => prev.filter(f => f.uri !== uri));
                  if (removed) {
                    deleteWorkspaceFileFromServer(removed).catch(() => {});
                  }
                }}
              />

              <TextInput
                multiline
                value={noteText}
                onChangeText={setNoteText}
                placeholder={t('notes.noteContentPlh')}
                placeholderTextColor={colors.textLight}
                textAlignVertical="top"
                scrollEnabled={false}
                autoCorrect
                style={{
                  color: colors.text,
                  fontSize: 16,
                  lineHeight: 25,
                  minHeight: 280,
                }}
                className="flex-1 font-normal"
              />
            </ScrollView>
          )}

          {/* Bottom attachment toolbar with Drawing Studio shortcut */}
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
            onAdd={added => setNoteFiles(prev => [...prev, ...added])}
          />
        </KeyboardLiftView>

        <CustomColorPickerModal
          visible={colorPickerOpen}
          initialColor={drawColor}
          isDark={isDark}
          colors={colors}
          language={language}
          onClose={() => setColorPickerOpen(false)}
          onSelect={handleSelectCustomColor}
        />
      </SafeAreaView>
    );
  }

  /* ============================================================================
   * VIEW 1: "ALL NOTES" SAMSUNG-NOTES STYLE GRID SCREEN
   * ============================================================================ */
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1">
      {/* Top Action Header */}
      {selectionMode ? (
        <View className="flex-row items-center justify-between px-4 pt-3 pb-3">
          <View className="flex-1 flex-row items-center">
            <Pressable
              onPress={() => {
                setSelectionMode(false);
                setSelectedIds(new Set());
              }}
              hitSlop={12}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="mr-3 h-11 w-11 items-center justify-center rounded-2xl border">
              <X size={22} color={colors.text} />
            </Pressable>
            <Text style={{ color: colors.text }} className="text-[19px] font-bold">
              {selectedIds.size} {t('common.selected')}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={toggleSelectAll}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="h-10 items-center justify-center rounded-xl border px-3">
              <Text style={{ color: colors.primary }} className="text-[13px] font-semibold">
                {filteredNotes.length > 0 && selectedIds.size >= filteredNotes.length
                  ? t('common.deselectAll')
                  : t('common.selectAll')}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDeleteSelected}
              disabled={selectedIds.size === 0}
              style={{
                backgroundColor:
                  selectedIds.size > 0 ? (isDark ? '#7F1D1D' : '#FEE2E2') : colors.surface,
                borderColor:
                  selectedIds.size > 0 ? (isDark ? '#991B1B' : '#FECACA') : colors.border,
                opacity: selectedIds.size === 0 ? 0.4 : 1,
              }}
              className="h-10 flex-row items-center justify-center rounded-xl border px-3.5">
              <Trash2 size={16} color="#DC2626" />
              <Text className="ml-1.5 text-[13px] font-bold text-red-600">
                {t('common.delete')} ({selectedIds.size})
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="px-4 pt-2 pb-1">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={12}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-70">
              <ChevronLeft size={24} color={colors.text} />
            </Pressable>

            <View className="flex-row items-center gap-2">
              {notes.length > 0 && (
                <>
                  <Pressable
                    onPress={() => setSearchOpen(v => !v)}
                    hitSlop={10}
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-70">
                    <Search size={20} color={colors.text} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setSelectionMode(true);
                      setSelectedIds(new Set());
                    }}
                    hitSlop={10}
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-70">
                    <CheckSquare size={20} color={colors.text} />
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {/* Centered Title Banner (Samsung Notes "All notes" style) */}
          <View className="my-4 items-center">
            <Text style={{ color: colors.text }} className="text-[28px] font-bold tracking-tight">
              {language === 'ru'
                ? 'Все заметки'
                : language === 'en'
                ? 'All notes'
                : 'Bütün qeydlər'}
            </Text>
            <Text style={{ color: colors.textMuted }} className="mt-1 text-sm font-medium">
              {notes.length}{' '}
              {language === 'ru' ? 'заметок' : language === 'en' ? 'notes' : 'qeyd'}
            </Text>
          </View>
        </View>
      )}

      {searchOpen && !selectionMode && (
        <SearchBar
          placeholder={t('notes.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
        />
      )}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        className="flex-1 px-4"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 4,
          paddingBottom: 130,
        }}>
        {!loaded ? null : filteredNotes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t('notes.emptyTitle')}
            text={t('notes.emptyDesc')}
          />
        ) : (
          groupedSections.map(section => (
            <View key={section.label} className="mb-6">
              <Text
                style={{ color: colors.text }}
                className="mb-3 px-1 text-[16px] font-bold">
                {section.label}
              </Text>

              <View className="flex-row flex-wrap justify-between">
                {section.items.map(note => {
                  const isSelected = selectedIds.has(note.id);
                  const hasDrawing = (note.strokes?.length ?? 0) > 0;
                  const audioCount = (note.files ?? []).filter(f => f.kind === 'audio').length;
                  const imageCount = (note.files ?? []).filter(f => f.kind === 'image').length;
                  const docCount = (note.files ?? []).filter(f => f.kind === 'document').length;

                  return (
                    <View
                      key={note.id}
                      style={{ width: '48%' }}
                      className="mb-5">
                      {/* Note Card Preview Box */}
                      <Pressable
                        onPress={() => {
                          if (selectionMode) {
                            toggleSelect(note.id);
                          } else {
                            openExistingNote(note);
                          }
                        }}
                        onLongPress={() => {
                          if (!selectionMode) {
                            setSelectionMode(true);
                            setSelectedIds(new Set([note.id]));
                          }
                        }}
                        delayLongPress={300}
                        style={{
                          height: 175,
                          backgroundColor: isDark ? '#1A2234' : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderWidth: isSelected ? 2 : 1,
                        }}
                        className="overflow-hidden rounded-3xl p-3.5 active:opacity-85">
                        {/* Selection Checkbox */}
                        {selectionMode && (
                          <View
                            style={{
                              borderColor: isSelected ? colors.primary : colors.textLight,
                              backgroundColor: isSelected ? colors.primary : 'rgba(0,0,0,0.25)',
                            }}
                            className="absolute right-3 top-3 z-20 h-6 w-6 items-center justify-center rounded-full border-2">
                            {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                          </View>
                        )}

                        {/* Drawing Miniature Preview */}
                        {hasDrawing ? (
                          <View className="flex-1 overflow-hidden rounded-xl">
                            <Svg
                              width="100%"
                              height="100%"
                              viewBox={`0 0 ${canvasWidth} ${CANVAS_HEIGHT}`}>
                              {note.strokes.map(st => (
                                <Path
                                  key={st.id}
                                  d={st.d}
                                  stroke={st.color}
                                  strokeWidth={st.width * 1.4}
                                  strokeOpacity={st.opacity ?? 1}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  fill="none"
                                />
                              ))}
                            </Svg>
                            {note.text.trim().length > 0 && (
                              <Text
                                style={{ color: colors.textMuted }}
                                className="mt-1 text-[11px]"
                                numberOfLines={1}>
                                {note.text.trim()}
                              </Text>
                            )}
                          </View>
                        ) : (
                          /* Text & Media Preview */
                          <View className="flex-1 justify-between">
                            <Text
                              style={{ color: colors.text }}
                              className="text-[13.5px] leading-5"
                              numberOfLines={5}>
                              {note.text.trim() || note.title}
                            </Text>

                            {/* Attachment Badges inside card */}
                            {(audioCount > 0 || imageCount > 0 || docCount > 0) && (
                              <View className="mt-2 flex-row flex-wrap gap-1.5">
                                {audioCount > 0 && (
                                  <View
                                    style={{ backgroundColor: isDark ? '#312E81' : '#E0E7FF' }}
                                    className="flex-row items-center rounded-lg px-2 py-1">
                                    <Mic size={11} color={colors.primary} />
                                    <Text
                                      style={{ color: colors.primary }}
                                      className="ml-1 text-[10px] font-bold">
                                      {audioCount}
                                    </Text>
                                  </View>
                                )}
                                {imageCount > 0 && (
                                  <View
                                    style={{ backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE' }}
                                    className="flex-row items-center rounded-lg px-2 py-1">
                                    <ImageIcon size={11} color={colors.primary} />
                                    <Text
                                      style={{ color: colors.primary }}
                                      className="ml-1 text-[10px] font-bold">
                                      {imageCount}
                                    </Text>
                                  </View>
                                )}
                                {docCount > 0 && (
                                  <View
                                    style={{ backgroundColor: isDark ? '#064E3B' : '#D1FAE5' }}
                                    className="flex-row items-center rounded-lg px-2 py-1">
                                    <FileText size={11} color="#10B981" />
                                    <Text
                                      style={{ color: '#10B981' }}
                                      className="ml-1 text-[10px] font-bold">
                                      {docCount}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        )}
                      </Pressable>

                      {/* Card Caption Below (Title + Timestamp, matching screenshot) */}
                      <View className="mt-2 items-center px-1">
                        <Text
                          style={{ color: colors.text }}
                          className="text-center text-[14px] font-bold"
                          numberOfLines={1}>
                          {note.title}
                        </Text>
                        <Text
                          style={{ color: colors.textMuted }}
                          className="mt-0.5 text-center text-[11.5px]">
                          {formatTimeHM(note.updatedAt || note.createdAt)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating Bottom-Right Compose Button */}
      {!selectionMode && (
        <View
          style={{ bottom: Math.max(insets.bottom, 20) + 28 }}
          className="absolute right-5 flex-row items-center">
          {/* Main New Note FAB (Samsung Notes style) */}
          <Pressable
            onPress={() => openNewNote(false)}
            accessibilityRole="button"
            accessibilityLabel={t('notes.newNote')}
            style={{
              backgroundColor: isDark ? '#262F45' : colors.surface,
              borderColor: isDark ? '#334155' : colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 7,
            }}
            className="h-15 w-15 items-center justify-center rounded-full border p-4 active:opacity-85">
            <SquarePen size={25} color="#F97316" strokeWidth={2.2} />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

/**
 * Renders notebook paper background lines/grid/dots inside the SVG drawing canvas.
 */
export function PaperBackground({
  width,
  height,
  style,
  isDark,
}: {
  width: number;
  height: number;
  style: PaperStyle;
  isDark: boolean;
}) {
  if (style === 'plain') return null;
  const strokeColor = isDark ? '#1E293B' : '#E2E8F0';
  const step = 28;
  const hLines: number[] = [];
  for (let y = step; y < height; y += step) {
    hLines.push(y);
  }
  const vLines: number[] = [];
  for (let x = step; x < width; x += step) {
    vLines.push(x);
  }

  if (style === 'lined') {
    return (
      <G>
        {hLines.map(y => (
          <Line
            key={`h_${y}`}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            stroke={strokeColor}
            strokeWidth={1}
          />
        ))}
      </G>
    );
  }

  if (style === 'grid') {
    return (
      <G>
        {hLines.map(y => (
          <Line
            key={`h_${y}`}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            stroke={strokeColor}
            strokeWidth={1}
          />
        ))}
        {vLines.map(x => (
          <Line
            key={`v_${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={height}
            stroke={strokeColor}
            strokeWidth={1}
          />
        ))}
      </G>
    );
  }

  if (style === 'dots') {
    return (
      <G>
        {hLines.map(y =>
          vLines.map(x => (
            <Circle
              key={`d_${x}_${y}`}
              cx={x}
              cy={y}
              r={1.5}
              fill={strokeColor}
            />
          )),
        )}
      </G>
    );
  }

  return null;
}

/**
 * Interactive 2D HSV Spectrum + Hue Slider + Extended Swatches + Hex Custom Color Picker Modal
 */
export function CustomColorPickerModal({
  visible,
  initialColor,
  isDark,
  colors,
  language,
  onClose,
  onSelect,
}: {
  visible: boolean;
  initialColor: string;
  isDark: boolean;
  colors: any;
  language: string;
  onClose: () => void;
  onSelect: (hex: string) => void;
}) {
  const [hsv, setHsv] = useState<{ h: number; s: number; v: number }>(() =>
    hexToHsv(initialColor),
  );
  const [hexInput, setHexInput] = useState(initialColor.toUpperCase());

  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  const boxWidthRef = useRef(280);
  const BOX_HEIGHT = 165;
  const HUE_HEIGHT = 28;

  useEffect(() => {
    if (visible) {
      const parsed = hexToHsv(initialColor);
      setHsv(parsed);
      setHexInput(initialColor.toUpperCase());
    }
  }, [visible, initialColor]);

  const currentHex = useMemo(() => hsvToHex(hsv.h, hsv.s, hsv.v), [hsv]);
  const pureHueHex = useMemo(() => hsvToHex(hsv.h, 1, 1), [hsv.h]);

  const updateSvFromTouch = useCallback((lx: number, ly: number) => {
    const w = Math.max(1, boxWidthRef.current);
    const s = Math.max(0, Math.min(1, lx / w));
    const v = Math.max(0, Math.min(1, 1 - ly / BOX_HEIGHT));
    const next = { h: hsvRef.current.h, s, v };
    setHsv(next);
    setHexInput(hsvToHex(next.h, next.s, next.v));
  }, []);

  const updateHueFromTouch = useCallback((lx: number) => {
    const w = Math.max(1, boxWidthRef.current);
    const h = Math.max(0, Math.min(359.9, (lx / w) * 360));
    const next = { h, s: hsvRef.current.s, v: hsvRef.current.v };
    setHsv(next);
    setHexInput(hsvToHex(next.h, next.s, next.v));
  }, []);

  const svPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: e => updateSvFromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
        onPanResponderMove: e => updateSvFromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
      }),
    [updateSvFromTouch],
  );

  const huePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: e => updateHueFromTouch(e.nativeEvent.locationX),
        onPanResponderMove: e => updateHueFromTouch(e.nativeEvent.locationX),
      }),
    [updateHueFromTouch],
  );

  const handleHexChange = (txt: string) => {
    const formatted = txt.startsWith('#') ? txt.toUpperCase() : `#${txt.toUpperCase()}`;
    setHexInput(formatted);
    if (/^#[0-9A-F]{6}$/.test(formatted)) {
      setHsv(hexToHsv(formatted));
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 items-center justify-center bg-black/65 px-5">
        <View
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="w-full max-w-md rounded-3xl border p-5 shadow-2xl">
          {/* Modal Header */}
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Palette size={20} color={colors.primary} />
              <Text style={{ color: colors.text }} className="ml-2 text-lg font-extrabold">
                {language === 'ru'
                  ? 'Палитра цветов'
                  : language === 'en'
                  ? 'Custom Color Palette'
                  : 'Xüsusi Rəng Palitrası'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={{ backgroundColor: colors.field }}
              className="h-8 w-8 items-center justify-center rounded-full">
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* 2D Saturation-Brightness Spectrum Box */}
          <View
            {...svPanResponder.panHandlers}
            onLayout={e => {
              boxWidthRef.current = e.nativeEvent.layout.width;
            }}
            style={{ height: BOX_HEIGHT, borderColor: colors.border }}
            className="w-full overflow-hidden rounded-2xl border">
            <View pointerEvents="none" className="flex-1">
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="satGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                    <Stop offset="100%" stopColor={pureHueHex} stopOpacity="1" />
                  </LinearGradient>
                  <LinearGradient id="valGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
                    <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#satGrad)" />
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#valGrad)" />
              </Svg>
              {/* Thumb Indicator */}
              <View
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  marginLeft: -11,
                  marginTop: -11,
                  backgroundColor: currentHex,
                  borderColor: '#FFFFFF',
                  borderWidth: 3,
                  shadowColor: '#000',
                  shadowOpacity: 0.45,
                  shadowRadius: 4,
                  elevation: 5,
                }}
                className="absolute h-[22px] w-[22px] rounded-full"
              />
            </View>
          </View>

          {/* Rainbow Hue Slider (0 - 360 deg) */}
          <View
            {...huePanResponder.panHandlers}
            style={{ height: HUE_HEIGHT, borderColor: colors.border }}
            className="mt-3.5 w-full justify-center overflow-hidden rounded-full border">
            <View pointerEvents="none" className="flex-1">
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="hueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#FF0000" />
                    <Stop offset="17%" stopColor="#FFFF00" />
                    <Stop offset="33%" stopColor="#00FF00" />
                    <Stop offset="50%" stopColor="#00FFFF" />
                    <Stop offset="67%" stopColor="#0000FF" />
                    <Stop offset="83%" stopColor="#FF00FF" />
                    <Stop offset="100%" stopColor="#FF0000" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#hueGrad)" />
              </Svg>
              <View
                style={{
                  left: `${(hsv.h / 360) * 100}%`,
                  top: 2,
                  marginLeft: -11,
                  backgroundColor: pureHueHex,
                  borderColor: '#FFFFFF',
                  borderWidth: 3,
                }}
                className="absolute h-[22px] w-[22px] rounded-full"
              />
            </View>
          </View>

          {/* Hybrid 3x9 Swatch Grid: Row 1 = Dynamic Shades of Current Hue, Rows 2-3 = Fixed Base Colors */}
          <View className="mt-4 gap-2">
            {/* Row 1: Dynamic Shades & Tints of Selected Hue */}
            <View className="flex-row gap-2">
              {SHADE_STEPS.map((step, idx) => {
                const shadeHex = hsvToHex(hsv.h, step.s, step.v);
                const selected = currentHex.toUpperCase() === shadeHex.toUpperCase();
                return (
                  <Pressable
                    key={`shade_${idx}`}
                    onPress={() => {
                      const next = { h: hsv.h, s: step.s, v: step.v };
                      setHsv(next);
                      setHexInput(shadeHex.toUpperCase());
                    }}
                    style={{
                      backgroundColor: shadeHex,
                      borderColor: selected ? colors.primary : isDark ? '#334155' : '#CBD5E1',
                      borderWidth: selected ? 2.5 : 1,
                    }}
                    className="h-8 flex-1 items-center justify-center rounded-xl">
                    {selected && (
                      <Check
                        size={13}
                        color={step.s < 0.45 && step.v > 0.85 ? '#0F172A' : '#FFFFFF'}
                        strokeWidth={3}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Rows 2 & 3: Fixed Base Colors */}
            {FIXED_PALETTE_ROWS.map((row, rowIdx) => (
              <View key={`row_${rowIdx}`} className="flex-row gap-2">
                {row.map(c => {
                  const selected = currentHex.toUpperCase() === c.toUpperCase();
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        setHsv(hexToHsv(c));
                        setHexInput(c.toUpperCase());
                      }}
                      style={{
                        backgroundColor: c,
                        borderColor: selected ? colors.primary : isDark ? '#334155' : '#CBD5E1',
                        borderWidth: selected ? 2.5 : 1,
                      }}
                      className="h-8 flex-1 items-center justify-center rounded-xl">
                      {selected && (
                        <Check
                          size={13}
                          color={
                            c === '#FFFFFF' || c === '#FDE047' || c === '#FCA5A5' || c === '#FDBA74'
                              ? '#0F172A'
                              : '#FFFFFF'
                          }
                          strokeWidth={3}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Live Color Preview + HEX Input + Apply Button */}
          <View className="mt-4 flex-row items-center gap-2.5">
            <View
              style={{ backgroundColor: currentHex, borderColor: colors.border }}
              className="h-11 w-11 rounded-2xl border-2"
            />
            <TextInput
              value={hexInput}
              onChangeText={handleHexChange}
              maxLength={7}
              autoCapitalize="characters"
              style={{
                backgroundColor: colors.field,
                color: colors.text,
                borderColor: colors.border,
              }}
              className="h-11 flex-1 rounded-2xl border px-3.5 text-sm font-bold tracking-wider"
            />
            <Pressable
              onPress={() => onSelect(currentHex)}
              style={{ backgroundColor: colors.primary }}
              className="h-11 flex-row items-center justify-center rounded-2xl px-5 active:opacity-85">
              <Check size={17} color="#FFFFFF" strokeWidth={2.5} />
              <Text className="ml-1.5 text-sm font-bold text-white">
                {language === 'ru' ? 'Выбрать' : language === 'en' ? 'Select' : 'Seç'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
