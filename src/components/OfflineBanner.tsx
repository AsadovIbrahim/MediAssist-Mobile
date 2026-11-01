import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { RefreshCw, WifiOff } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useOfflineSync } from '../utils/offlineSync';

interface OfflineBannerProps {
  onSyncComplete?: () => void | Promise<void>;
}

export function OfflineBanner({ onSyncComplete }: OfflineBannerProps = {}) {
  const { isOnline, pendingCount, isSyncing, sync } = useOfflineSync();
  const { t } = useLanguage();
  const { colors, isDark } = useTheme();

  const handleSync = async () => {
    await sync();
    onSyncComplete?.();
  };

  // If online and nothing is waiting to sync, don't show anything
  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: !isOnline
          ? (isDark ? '#451A03' : '#FEF3C7')
          : (isDark ? '#1E293B' : '#E2E8F0'),
        borderColor: !isOnline
          ? (isDark ? '#78350F' : '#FCD34D')
          : (isDark ? '#334155' : '#CBD5E1'),
      }}
      className="mx-4 mb-3 flex-row items-center justify-between rounded-2xl border px-3.5 py-2.5">
      <View className="flex-1 flex-row items-center pr-2">
        {!isOnline ? (
          <WifiOff
            size={18}
            color={isDark ? '#FBBF24' : '#B45309'}
            strokeWidth={2.2}
          />
        ) : (
          <RefreshCw
            size={18}
            color={colors.primary}
            strokeWidth={2.2}
          />
        )}
        <Text
          style={{
            color: !isOnline
              ? (isDark ? '#FDE68A' : '#92400E')
              : colors.text,
          }}
          className="ml-2.5 text-[13px] font-semibold"
          numberOfLines={1}>
          {!isOnline
            ? t('offline.banner')
            : `${pendingCount} ${t('offline.pending')}`}
        </Text>
      </View>

      {isOnline && pendingCount > 0 && (
        <Pressable
          onPress={handleSync}
          disabled={isSyncing}
          style={{ backgroundColor: colors.primary }}
          className="flex-row items-center rounded-xl px-3 py-1.5 active:opacity-75">
          {isSyncing ? (
            <ActivityIndicator size="small" color="#ffffff" style={{ transform: [{ scale: 0.75 }] }} />
          ) : (
            <Text className="text-[12px] font-bold text-white">
              {t('offline.syncNow')}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
