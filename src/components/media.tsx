import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FileText,
  Mic,
  Pause,
  Play,
  Square,
  X,
} from 'lucide-react-native';
import { fileUrl } from '../api/client';
import type { FileItem, LocalFile } from '../api/types';
import { colors, tints } from '../theme';
import {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  OutputFormatAndroidType,
  type AudioSet,
} from 'react-native-nitro-sound';
import { Sound, stopAudio, toggleAudio, useAudio } from '../utils/audio';

/**
 * Compact AAC voice-memo preset (Mono, 22.05 kHz, 32 kbps AAC -> ~240 KB/min).
 * Saves ~6x storage & bandwidth compared to default 192 kbps stereo.
 */
const VOICE_AAC_CONFIG: AudioSet = {
  AudioSourceAndroid: AudioSourceAndroidType.MIC,
  OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  AudioQuality: 'low',
  AudioChannels: 1,
  AudioSamplingRate: 22050,
  AudioEncodingBitRate: 32000,
  AVEncodingOptionIOS: 'aac',
  AVFormatIDKeyIOS: 'aac',
  AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.medium,
  AVNumberOfChannelsKeyIOS: 1,
  AVSampleRateKeyIOS: 22050,
};
import { formatDuration, formatSize } from '../utils/format';
import { docLabel, requestMicPermission } from '../utils/media';

/* ------------------------------------------------------------------ */
/* Document badge: [PDF icon] PDF • 1.4 MB                              */
/* ------------------------------------------------------------------ */

export function FileBadge({ file }: { file: FileItem }) {
  const label = docLabel(file);
  const color = label === 'PDF' ? tints.red.fg : tints.blue.fg;
  return (
    <Pressable
      onPress={() => openRemoteFile(file)}
      hitSlop={6}
      className="mt-1.5 flex-row items-center self-start">
      <View
        style={{ backgroundColor: label === 'PDF' ? tints.red.bg : tints.blue.bg }}
        className="mr-1.5 h-5 w-5 items-center justify-center rounded">
        <FileText size={12} color={color} strokeWidth={2.4} />
      </View>
      <Text className="text-xs text-ink-muted">
        {label}
        {file.fileSize ? ` • ${formatSize(file.fileSize)}` : ''}
      </Text>
    </Pressable>
  );
}

export function openRemoteFile(file: FileItem) {
  const url = fileUrl(file.filePath);
  if (url) {
    Linking.openURL(url).catch(() => Alert.alert('Xəta', 'Fayl açıla bilmədi.'));
  }
}

/* ------------------------------------------------------------------ */
/* Image thumbnails strip with "+N" and fullscreen viewer              */
/* ------------------------------------------------------------------ */

export function ImageStrip({
  files,
  max = 3,
  size = 64,
  wideSingle,
}: {
  files: FileItem[];
  max?: number;
  size?: number;
  wideSingle?: boolean;
}) {
  const [viewer, setViewer] = useState<number | null>(null);
  if (!files.length) {
    return null;
  }
  const shown = files.slice(0, max);
  const extra = files.length - max;
  const itemWidth = wideSingle && files.length === 1 ? size * 2.1 : size;
  return (
    <>
      <View className="mt-2 flex-row gap-1.5">
        {shown.map((f, i) => {
          const isLast = i === shown.length - 1 && extra > 0;
          return (
            <Pressable key={f.id} onPress={() => setViewer(i)}>
              <Image
                source={{ uri: fileUrl(f.filePath) }}
                style={{
                  width: itemWidth,
                  height: size,
                  borderRadius: 10,
                  backgroundColor: colors.input,
                }}
              />
              {isLast && (
                <View
                  style={{ width: itemWidth, height: size, borderRadius: 10 }}
                  className="absolute items-center justify-center bg-black/45">
                  <Text className="text-base font-semibold text-white">+{extra + 1}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      <ImageViewer
        uris={files.map(f => fileUrl(f.filePath) ?? '')}
        index={viewer}
        onClose={() => setViewer(null)}
      />
    </>
  );
}

export function ImageViewer({
  uris,
  index,
  onClose,
}: {
  uris: string[];
  index: number | null;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(index ?? 0);
  useEffect(() => {
    if (index !== null) {
      setCurrent(index);
    }
  }, [index]);
  return (
    <Modal visible={index !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        <Pressable
          onPress={onClose}
          className="absolute right-4 top-12 z-10 h-10 w-10 items-center justify-center rounded-full bg-white/20">
          <X size={22} color="#fff" />
        </Pressable>
        <Pressable
          className="flex-1"
          onPress={() => setCurrent(c => (uris.length ? (c + 1) % uris.length : 0))}>
          <Image source={{ uri: uris[current] }} resizeMode="contain" style={{ flex: 1 }} />
        </Pressable>
        {uris.length > 1 && (
          <Text className="absolute bottom-10 self-center text-sm text-white/80">
            {current + 1} / {uris.length}
          </Text>
        )}
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Voice player pill: (▶) ||||||||||| 0:24                              */
/* ------------------------------------------------------------------ */

const BAR_COUNT = 28;

function bars(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    h = (h * 1103515245 + 12345 + i) >>> 0;
    return 0.25 + ((h >>> 8) % 1000) / 1333;
  });
}

export function Waveform({ seed, progress }: { seed: string; progress: number }) {
  const data = useMemo(() => bars(seed), [seed]);
  return (
    <View className="mx-2.5 h-6 flex-1 flex-row items-center justify-between">
      {data.map((v, i) => (
        <View
          key={i}
          style={{
            width: 2.5,
            height: `${Math.round(v * 100)}%`,
            borderRadius: 2,
            backgroundColor: i / BAR_COUNT < progress ? colors.primary : '#B9C3D3',
          }}
        />
      ))}
    </View>
  );
}

export function VoicePlayer({
  uri,
  fallbackLabel,
  durationMs,
}: {
  uri: string | undefined;
  fallbackLabel?: string;
  durationMs?: number;
}) {
  const { playing, position, duration } = useAudio(uri);
  const total = duration || durationMs || 0;
  const progress = total ? position / total : 0;
  const onPress = async () => {
    if (!uri) {
      return;
    }
    try {
      await toggleAudio(uri);
    } catch (e) {
      Alert.alert('Xəta', `Səs faylı oxunmadı: ${(e as Error).message}`);
    }
  };
  const label = playing || position ? formatDuration(position) : total ? formatDuration(total) : fallbackLabel ?? '0:00';
  return (
    <View className="mt-2 flex-row items-center rounded-xl bg-field px-2 py-2">
      <Pressable
        onPress={onPress}
        hitSlop={8}
        className="h-8 w-8 items-center justify-center rounded-full bg-primary">
        {playing ? (
          <Pause size={14} color="#fff" fill="#fff" />
        ) : (
          <Play size={14} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
        )}
      </Pressable>
      <Waveform seed={uri ?? 'voice'} progress={progress} />
      <Text className="mr-1 min-w-[34px] text-right text-xs font-medium text-ink-muted">{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Pending local file row (form screens)                               */
/* ------------------------------------------------------------------ */

export function LocalFileRow({
  file,
  onRemove,
  last,
}: {
  file: LocalFile;
  onRemove: () => void;
  last?: boolean;
}) {
  const { playing } = useAudio(file.kind === 'audio' ? file.uri : undefined);
  return (
    <View className={`flex-row items-center py-3 ${last ? '' : 'border-b border-line'}`}>
      {file.kind === 'image' ? (
        <Image source={{ uri: file.uri }} style={{ width: 44, height: 44, borderRadius: 10 }} />
      ) : file.kind === 'audio' ? (
        <Pressable
          onPress={() => toggleAudio(file.uri).catch(() => undefined)}
          style={{ backgroundColor: tints.blue.bg }}
          className="h-11 w-11 items-center justify-center rounded-xl">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-primary">
            {playing ? (
              <Pause size={12} color="#fff" fill="#fff" />
            ) : (
              <Play size={12} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
            )}
          </View>
        </Pressable>
      ) : (
        <View
          style={{ backgroundColor: tints.red.bg }}
          className="h-11 w-11 items-center justify-center rounded-xl">
          <FileText size={22} color={tints.red.fg} />
        </View>
      )}
      <View className="ml-3 flex-1">
        <Text className="text-sm font-medium text-ink" numberOfLines={1}>
          {file.name}
        </Text>
        <Text className="mt-0.5 text-xs text-ink-muted">
          {file.kind === 'audio' ? formatDuration(file.durationMs) : formatSize(file.size)}
        </Text>
      </View>
      <Pressable onPress={onRemove} hitSlop={10} className="p-1">
        <X size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Voice recorder bottom sheet                                         */
/* ------------------------------------------------------------------ */

export function RecorderModal({
  visible,
  onClose,
  onRecorded,
}: {
  visible: boolean;
  onClose: () => void;
  onRecorded: (file: LocalFile) => void;
}) {
  const insets = useSafeAreaInsets();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (!visible) {
      setRecording(false);
      setElapsed(0);
      elapsedRef.current = 0;
    }
  }, [visible]);

  const start = async () => {
    if (!(await requestMicPermission())) {
      return;
    }
    try {
      await stopAudio();
      Sound.addRecordBackListener(e => {
        elapsedRef.current = e.currentPosition;
        setElapsed(e.currentPosition);
      });
      await Sound.startRecorder(undefined, VOICE_AAC_CONFIG);
      setRecording(true);
    } catch (e) {
      Sound.removeRecordBackListener();
      Alert.alert('Xəta', `Səs yazılması başlamadı: ${(e as Error).message}`);
    }
  };

  const stop = async () => {
    try {
      const path = await Sound.stopRecorder();
      Sound.removeRecordBackListener();
      setRecording(false);
      const uri = path.startsWith('file://') || path.startsWith('content://') ? path : `file://${path}`;
      const ext = (/\.(\w+)$/.exec(path)?.[1] ?? 'm4a').toLowerCase();
      const finalExt = ext === 'mp4' ? 'm4a' : ext;
      onRecorded({
        uri,
        name: `sikayet_ses_${Date.now()}.${finalExt}`,
        type: finalExt === 'm4a' ? 'audio/mp4' : `audio/${finalExt}`,
        durationMs: elapsedRef.current,
        kind: 'audio',
      });
      onClose();
    } catch (e) {
      Alert.alert('Xəta', (e as Error).message);
    }
  };

  const cancel = async () => {
    if (recording) {
      try {
        await Sound.stopRecorder();
      } catch {
        // ignore
      }
      Sound.removeRecordBackListener();
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cancel}>
      <Pressable className="flex-1 bg-black/40" onPress={cancel} />
      <View
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 20 }}
        className="items-center rounded-t-3xl bg-surface px-6 pt-6">
        <View className="mb-6 h-1 w-10 rounded-full bg-line" />
        <Text className="text-base font-semibold text-ink">Səs qeydi</Text>
        <Text className="mt-6 text-4xl font-light text-ink">{formatDuration(elapsed)}</Text>
        <Text className="mt-1 text-sm text-ink-muted">
          {recording ? 'Yazılır...' : 'Başlamaq üçün düyməyə toxunun'}
        </Text>
        <Pressable
          onPress={recording ? stop : start}
          style={{ backgroundColor: recording ? colors.danger : tints.red.bg }}
          className="mt-8 h-20 w-20 items-center justify-center rounded-full">
          {recording ? (
            <Square size={28} color="#fff" fill="#fff" />
          ) : (
            <Mic size={34} color={colors.danger} />
          )}
        </Pressable>
        <Pressable onPress={cancel} className="mt-6">
          <Text className="text-sm font-medium text-ink-muted">Ləğv et</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
