import React from 'react';
import { Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { fileUrl } from '../api/client';
import { recordVisual, splitFiles, type RecordItem, type RecordKind } from '../features/records';
import { colors } from '../theme';
import { formatDate, formatSize } from '../utils/format';
import { FileBadge, ImageStrip, VoicePlayer } from './media';
import { Card, IconTile } from './ui';

/** List row used by Şikayətlər / Diaqnoz / Müalicə lists and search results. */
export function RecordCard({
  kind,
  item,
  onPress,
}: {
  kind: RecordKind;
  item: RecordItem;
  onPress: () => void;
}) {
  const { icon, tint } = recordVisual(kind, item);
  const { images, audios, docs } = splitFiles(item.files);
  const showDescription = !!item.description && !images.length && !audios.length && !docs.length;

  return (
    <Card onPress={onPress} className="mx-4 mb-3 flex-row p-3.5">
      <IconTile icon={icon} tint={tint} size={46} variant="soft" />
      <View className="ml-3 flex-1">
        <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
          {item.title}
        </Text>
        <Text className="mt-0.5 text-xs text-ink-muted">{formatDate(item.date)}</Text>

        {showDescription && (
          <Text className="mt-1.5 text-[13px] leading-5 text-ink-muted" numberOfLines={2}>
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
      <View className="ml-1 justify-center">
        <ChevronRight size={18} color={colors.textLight} />
      </View>
    </Card>
  );
}

