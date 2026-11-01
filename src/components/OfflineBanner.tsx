import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { RefreshCw, WifiOff } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { offlineSyncService, useOfflineSync } from '../utils/offlineSync';

interface OfflineBannerProps {
  onSyncComplete?: () => void | Promise<void>;
}

export function OfflineBanner({ onSyncComplete }: OfflineBannerProps = {}) {
  const { isOnline, pendingCount, isSyncing, sync } = useOfflineSync();
  const { t } = useLanguage();
  const { colors, isDark } = useTheme();

  // Automatically trigger sync when online and there are pending items
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      sync();
    }
  }, [isOnline, pendingCount, isSyncing]);

  // When background sync completes, invoke onSyncComplete callback
  useEffect(() => {
    return offlineSyncService.onSyncCompleted(() => {
      onSyncComplete?.();
    });
  }, [onSyncComplete]);

  // If online and nothing is waiting to sync, don't show anything
  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: !isOnline
          ? (isDark ? '#451A03' : '#FEF3C7')
          : (isDark ? '#1E293B' : '#EFF6FF'),
        borderColor: !isOnline
          ? (isDark ? '#78350F' : '#FCD34D')
          : (isDark ? '#334155' : '#BFDBFE'),
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
            color="#2563EB"
            strokeWidth={2.2}
          />
        )}
        <Text
          style={{
            color: !isOnline
              ? (isDark ? '#FDE68A' : '#92400E')
              : (isDark ? '#93C5FD' : '#1D4ED8'),
          }}
          className="ml-2.5 text-[13px] font-semibold"
          numberOfLines={1}>
          {!isOnline
            ? t('offline.banner')
            : t('offline.syncing')}
        </Text>
      </View>

      {isOnline && (
        <View className="flex-row items-center rounded-xl bg-[#2563EB]/10 px-2.5 py-1">
          <ActivityIndicator
            size="small"
            color="#2563EB"
            style={{ transform: [{ scale: 0.75 }] }}
          />
          <Text className="ml-1.5 text-[11px] font-bold text-[#2563EB]">
            {pendingCount}
          </Text>
        </View>
      )}
    </View>
  );
}
