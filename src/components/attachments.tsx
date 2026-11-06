import React, { useMemo, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { fileUrl } from '../api/client';
import { ImageViewer, RecorderModal, VoicePlayer } from './media';
import { useKeyboard } from './ui';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { formatSize } from '../utils/format';
import { pickDocuments, pickImages, takePhoto } from '../utils/media';
import type { LocalFile } from '../api/types';

function resolveUri(uri: string): string {
  return fileUrl(uri) ?? uri;
}

/* ------------------------------------------------------------------ */
/* Synced & local attachments: voice notes, image grid, documents      */
/* ------------------------------------------------------------------ */

export function AttachmentsView({
  files,
  onRemove,
}: {
  files: LocalFile[];
  onRemove: (uri: string) => void;
}) {
  const { colors, tints } = useTheme();
  const { t } = useLanguage();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [failedLocal, setFailedLocal] = useState<Record<string, boolean>>({});

  const imageFiles = useMemo(() => files.filter(f => f.kind === 'image'), [files]);
  const audioFiles = useMemo(() => files.filter(f => f.kind === 'audio'), [files]);
  const docFiles = useMemo(
    () => files.filter(f => f.kind !== 'image' && f.kind !== 'audio'),
    [files],
  );

  if (!files.length) {
    return null;
  }

  const getImageSourceUri = (img: LocalFile) => {
    if (img.localUri && !failedLocal[img.uri]) {
      return img.localUri;
    }
    return resolveUri(img.uri);
  };

  return (
    <>
      {/* Voice recordings */}
      {audioFiles.length > 0 && (
        <View className="mb-3">
          {audioFiles.map(audio => {
            const remoteUri = resolveUri(audio.uri);
            const primaryUri = audio.localUri || remoteUri;
            return (
              <View
                key={audio.uri}
                style={{ backgroundColor: colors.field, borderColor: colors.border }}
                className="mb-2 flex-row items-center rounded-xl border p-2">
                <View className="flex-1">
                  <VoicePlayer
                    uri={primaryUri}
                    fallbackUri={remoteUri}
                    durationMs={audio.durationMs}
                    fallbackLabel={t('form.voiceNote')}
                  />
                </View>
                <Pressable
                  onPress={() => onRemove(audio.uri)}
                  hitSlop={10}
                  style={{ backgroundColor: colors.surface }}
                  className="ml-2 h-7 w-7 items-center justify-center rounded-full active:opacity-75">
                  <X size={15} color={colors.danger} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* Image thumbnails */}
      {imageFiles.length > 0 && (
        <View className="mb-3 flex-row flex-wrap gap-2.5">
          {imageFiles.map((img, imgIdx) => (
            <View key={img.uri} className="relative">
              <Pressable onPress={() => setViewerIndex(imgIdx)} className="active:opacity-80">
                <Image
                  source={{ uri: getImageSourceUri(img) }}
                  onError={() => {
                    if (img.localUri && !failedLocal[img.uri]) {
                      setFailedLocal(prev => ({ ...prev, [img.uri]: true }));
                    }
                  }}
                  style={{
                    width: 82,
                    height: 82,
                    borderRadius: 12,
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                />
              </Pressable>
              <Pressable
                onPress={() => onRemove(img.uri)}
                hitSlop={8}
                style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
                className="absolute top-1 right-1 h-6 w-6 items-center justify-center rounded-full active:opacity-80">
                <X size={13} color="#ffffff" strokeWidth={2.6} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Documents */}
      {docFiles.length > 0 && (
        <View className="mb-3">
          {docFiles.map(doc => (
            <Pressable
              key={doc.uri}
              onPress={async () => {
                const remoteTarget = resolveUri(doc.uri);
                if (doc.localUri) {
                  try {
                    await Linking.openURL(doc.localUri);
                    return;
                  } catch {}
                }
                if (remoteTarget) {
                  Linking.openURL(remoteTarget).catch(() =>
                    Alert.alert(t('common.error'), doc.name),
                  );
                }
              }}
              style={{ backgroundColor: colors.field, borderColor: colors.border }}
              className="mb-2 flex-row items-center rounded-xl border p-2.5 active:opacity-80">
              <View
                style={{ backgroundColor: tints.blue.tile }}
                className="h-10 w-10 items-center justify-center rounded-xl">
                <FileText size={20} color={tints.blue.fg} />
              </View>
              <View className="ml-3 flex-1">
                <Text style={{ color: colors.text }} className="text-sm font-semibold" numberOfLines={1}>
                  {doc.name}
                </Text>
                {doc.size ? (
                  <Text style={{ color: colors.textMuted }} className="mt-0.5 text-xs">
                    {formatSize(doc.size)}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => onRemove(doc.uri)} hitSlop={10} className="p-1.5 active:opacity-75">
                <X size={18} color={colors.danger} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}

      {viewerIndex !== null && imageFiles.length > 0 && (
        <ImageViewer
          uris={imageFiles.map(f => getImageSourceUri(f))}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom toolbar: [optional leading action] Camera Gallery File Mic   */
/* ------------------------------------------------------------------ */

export interface ToolbarAction {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}

export function AttachmentToolbar({
  onAdd,
  leading,
  secondaryLeading,
}: {
  onAdd: (files: LocalFile[]) => void;
  leading?: ToolbarAction;
  secondaryLeading?: ToolbarAction;
}) {
  const insets = useSafeAreaInsets();
  const { keyboardHeight } = useKeyboard();
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const [recorderVisible, setRecorderVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  const add = (picked: LocalFile[]) => {
    if (picked.length > 0) {
      onAdd(picked);
    }
  };

  // Close the sheet first, then launch the native picker (iOS cannot present
  // a picker while another modal is still animating out).
  const runAfterSheetClose = (action: () => void | Promise<void>) => {
    setSheetVisible(false);
    setTimeout(() => {
      Promise.resolve(action()).catch(() => {});
    }, 350);
  };

  const bottomPad = keyboardHeight > 0 ? 8 : Math.max(insets.bottom, 10);

  const sheetOptions: Array<{
    key: string;
    icon: LucideIcon;
    label: string;
    bg: string;
    onPress: () => void;
  }> = [
    {
      key: 'camera',
      icon: Camera,
      label: t('form.camera'),
      bg: '#3B82F6',
      onPress: () => runAfterSheetClose(async () => add(await takePhoto())),
    },
    {
      key: 'gallery',
      icon: ImageIcon,
      label: t('record.filterImages'),
      bg: '#A855F7',
      onPress: () => runAfterSheetClose(async () => add(await pickImages())),
    },
    {
      key: 'document',
      icon: FileText,
      label: t('record.addFile'),
      bg: '#F97316',
      onPress: () => runAfterSheetClose(async () => add(await pickDocuments())),
    },
  ];

  return (
    <>
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: bottomPad,
        }}
        className="flex-row items-center justify-around border-t px-4">
        {leading && <ToolbarButton {...leading} color={colors.primary} />}
        {secondaryLeading && <ToolbarButton {...secondaryLeading} color={colors.primary} />}
        <ToolbarButton
          icon={Paperclip}
          label={language === 'ru' ? 'Прикрепить' : language === 'en' ? 'Attach' : 'Əlavə et'}
          onPress={() => setSheetVisible(true)}
          color={colors.primary}
        />
        <ToolbarButton
          icon={Mic}
          label={t('form.voiceNote')}
          onPress={() => setRecorderVisible(true)}
          color={colors.primary}
        />
      </View>

      {/* Attachment bottom sheet (WhatsApp / Telegram / Samsung Notes style) */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSheetVisible(false)}>
        <Pressable onPress={() => setSheetVisible(false)} className="flex-1 justify-end bg-black/50">
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            }}
            className="rounded-t-3xl border-t px-5 pt-3">
            {/* Grab handle */}
            <View
              style={{ backgroundColor: isDark ? '#475569' : '#CBD5E1' }}
              className="mb-4 h-1.5 w-10 self-center rounded-full"
            />

            <Text style={{ color: colors.text }} className="mb-5 px-1 text-[17px] font-bold">
              {language === 'ru' ? 'Прикрепить' : language === 'en' ? 'Attach' : 'Əlavə et'}
            </Text>

            <View className="mb-5 flex-row justify-around">
              {sheetOptions.map(opt => {
                const Icon = opt.icon;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={opt.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={opt.label}
                    className="w-24 items-center active:opacity-70">
                    <View
                      style={{ backgroundColor: opt.bg }}
                      className="h-16 w-16 items-center justify-center rounded-full">
                      <Icon size={28} color="#FFFFFF" strokeWidth={2} />
                    </View>
                    <Text
                      style={{ color: colors.text }}
                      className="mt-2 text-center text-[13px] font-semibold"
                      numberOfLines={1}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setSheetVisible(false)}
              style={{ backgroundColor: colors.field }}
              className="items-center justify-center rounded-2xl py-3.5 active:opacity-75">
              <Text style={{ color: colors.textMuted }} className="text-[15px] font-bold">
                {t('common.cancel')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <RecorderModal
        visible={recorderVisible}
        onClose={() => setRecorderVisible(false)}
        onRecorded={file => onAdd([file])}
      />
    </>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onPress,
  color,
}: ToolbarAction & { color: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 w-14 items-center justify-center rounded-xl active:opacity-60">
      <Icon size={24} color={color} strokeWidth={2} />
    </Pressable>
  );
}

