import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, Pencil } from 'lucide-react-native';
import { fileUrl } from '../api/client';
import { recordVisual, splitFiles, type RecordItem, type RecordKind } from '../features/records';
import { colors } from '../theme';
import { formatDate, formatSize } from '../utils/format';
import { FileBadge, ImageStrip, VoicePlayer } from './media';
import { Card, IconTile } from './ui';

/** List row used by Şikayətlər / Müayinələr / Diaqnoz / Müalicə lists and search results. */
export function RecordCard({
  kind,
  item,
  onPress,
  onEdit,
}: {
  kind: RecordKind;
  item: RecordItem;
  onPress: () => void;
  onEdit?: () => void;
}) {
  const { icon, tint } = recordVisual(kind, item);
  const { images, audios, docs } = splitFiles(item.files);
  const showDescription = !!item.description && !images.length && !audios.length && !docs.length;

  return (
    <Card onPress={onPress} className="mx-4 mb-3.5 flex-row p-4">
      <IconTile icon={icon} tint={tint} size={52} iconSize={26} variant="soft" />
      <View className="ml-3.5 flex-1">
        <Text className="text-[17px] font-bold text-ink" numberOfLines={1}>
          {item.title}
        </Text>
        <Text className="mt-1 text-[14px] font-medium text-ink-muted">{formatDate(item.date)}</Text>

        {showDescription && (
          <Text className="mt-2 text-[14px] leading-6 text-ink-muted" numberOfLines={2}>
            {item.description}
          </Text>
        )}
        {images.length > 0 && (
          <ImageStrip
            files={images}
            wideSingle={kind === 'treatment' && item.kind === 'Prescription'}
          />
        )}
        {audios.length > 0 && (
          <VoicePlayer uri={fileUrl(audios[0].filePath)} fallbackLabel={formatSize(audios[0].fileSize)} />
        )}
        {docs.length > 0 && !images.length && <FileBadge file={docs[0]} />}
      </View>
      <View className="ml-2 flex-row items-center">
        {onEdit && (
          <Pressable
            onPress={e => {
              e.stopPropagation();
              onEdit();
            }}
            hitSlop={10}
            className="mr-2 h-10 w-10 items-center justify-center rounded-xl bg-primary-soft active:opacity-70">
            <Pencil size={18} color={colors.primary} />
          </Pressable>
        )}
        <ChevronRight size={22} color={colors.textLight} />
      </View>
    </Card>
  );
}

