import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, ChevronRight, Pencil } from 'lucide-react-native';
import { fileUrl } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import {
  getRecordConfig,
  isDefaultOrGenericRecordTitle,
  localizeRecordTitle,
  recordVisual,
  splitFiles,
  type RecordItem,
  type RecordKind,
} from '../features/records';
import { formatDate, formatSize } from '../utils/format';
import { FileBadge, ImageStrip, VoicePlayer } from './media';
import { Card, IconTile } from './ui';

/** List row used by Şikayətlər / Müayinələr / Diaqnoz / Müalicə lists and search results. */
export function RecordCard({
  kind,
  item,
  patientName,
  onPress,
  onEdit,
  selectionMode,
  selected,
  onLongPress,
}: {
  kind: RecordKind;
  item: RecordItem;
  patientName?: string;
  onPress: () => void;
  onEdit?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onLongPress?: () => void;
}) {
  const { language, t } = useLanguage();
  const { colors, isDark } = useTheme();
  const { icon, tint } = recordVisual(kind, item);
  const { images, audios, docs } = splitFiles(item.files);
  const hasFiles = images.length > 0 || audios.length > 0 || docs.length > 0;
  const isGenericTitle = isDefaultOrGenericRecordTitle(item.title, kind);
  // Hide title if this is a file record with a generic default title
  const showTitle = hasFiles ? !isGenericTitle : true;

  const rawDesc = (item.description ?? '').trim();
  const rawTitle = (item.title ?? '').trim();
  const cleanTitlePrefix = rawTitle.replace(/\.\.\.$/, '').trim();
  const extraDescription =
    rawDesc && rawDesc.toLowerCase() !== rawTitle.toLowerCase()
      ? rawDesc.toLowerCase().startsWith(cleanTitlePrefix.toLowerCase())
        ? rawDesc.slice(cleanTitlePrefix.length).replace(/^[.\s\n]+/, '').trim()
        : rawDesc
      : '';
  const showDescription =
    Boolean(extraDescription) && !images.length && !audios.length && !docs.length;

  return (
    <Card
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected
          ? (isDark ? '#1E293B' : '#EFF6FF')
          : colors.surface,
      }}
      className="mx-4 mb-3.5 flex-row items-center p-4">
      {selectionMode && (
        <View
          style={{
            borderColor: selected ? colors.primary : colors.textLight,
            backgroundColor: selected ? colors.primary : 'transparent',
          }}
          className="mr-3 h-6 w-6 items-center justify-center rounded-full border-2">
          {selected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </View>
      )}

      <IconTile icon={icon} tint={tint} size={52} iconSize={26} variant="soft" />
      <View className="ml-3.5 flex-1">
        {showTitle && (
          <Text style={{ color: colors.text }} className="text-[17px] font-bold" numberOfLines={1}>
            {localizeRecordTitle(item.title, kind, t)}
          </Text>
        )}
        <Text
          style={{ color: showTitle ? colors.textMuted : colors.text }}
          className={showTitle ? 'mt-1 text-[14px] font-medium' : 'text-[15px] font-semibold'}
          numberOfLines={1}>
          {patientName ? `${patientName} • ` : ''}{formatDate(item.date, language)}
        </Text>

        {showDescription && (
          <Text style={{ color: colors.textMuted }} className="mt-2 text-[14px] leading-6" numberOfLines={2}>
            {extraDescription}
          </Text>
        )}
        {images.length > 0 && (
          <View className={showTitle ? '' : 'mt-1.5'}>
            <ImageStrip
              files={images}
              wideSingle={kind === 'treatment' && item.kind === 'Prescription'}
            />
          </View>
        )}
        {audios.length > 0 && (
          <View className={showTitle ? '' : 'mt-1.5'}>
            <VoicePlayer uri={fileUrl(audios[0].filePath)} fallbackLabel={formatSize(audios[0].fileSize)} />
          </View>
        )}
        {docs.length > 0 && !images.length && (
          <View className={showTitle ? '' : 'mt-1.5'}>
            <FileBadge file={docs[0]} />
          </View>
        )}
      </View>

      {!selectionMode && (
        <View className="ml-2 flex-row items-center">
          {onEdit && (
            <Pressable
              onPress={e => {
                e.stopPropagation();
                onEdit();
              }}
              hitSlop={10}
              style={{ backgroundColor: isDark ? '#1E3A8A' : colors.primarySoft }}
              className="mr-2 h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
              <Pencil size={18} color={colors.primary} />
            </Pressable>
          )}
          <ChevronRight size={22} color={colors.textLight} />
        </View>
      )}
    </Card>
  );
}
