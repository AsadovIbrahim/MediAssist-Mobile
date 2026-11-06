import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Edit3,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { fileUrl } from '../api/client';
import { patientsApi } from '../api/services';
import type { Patient } from '../api/types';
import { ImageViewer } from '../components/media';
import { OfflineBanner } from '../components/OfflineBanner';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  ScreenHeader,
  SearchBar,
} from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { patientDisplayPhone, patientFullName, usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';
import type { RootScreenProps } from '../navigation/types';

export function PatientsScreen({ navigation }: RootScreenProps<'Patients'>) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors, tints, isDark } = useTheme();
  const { patients, loading, error, refresh, select } = usePatient();
  const [search, setSearch] = useState('');
  const [viewPhotoUri, setViewPhotoUri] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return patients;
    }
    return patients.filter(
      p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q),
    );
  }, [patients, search]);

  const confirmDelete = (p: Patient) => {
    Alert.alert(t('home.deleteConfirmTitle'), patientFullName(p), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await patientsApi.remove(p.id);
            await refresh();
          } catch (e) {
            Alert.alert(t('common.error'), (e as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.background }} className="flex-1">
      <ScreenHeader title={t('home.patientList')} />

      <OfflineBanner />

      {/* Search Bar */}
      <SearchBar
        placeholder={t('home.searchPlaceholder')}
        value={search}
        onChangeText={setSearch}
      />

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 96 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        renderItem={({ item }) => (
          <Card
            onPress={async () => {
              await select(item.id);
              navigation.navigate('PatientDashboard');
            }}
            className="mx-4 mb-3.5 flex-row items-center p-4">
            {item.photoUrl ? (
              <Pressable
                onPress={e => {
                  e.stopPropagation();
                  setViewPhotoUri(fileUrl(item.photoUrl) || null);
                }}
                hitSlop={6}
                className="active:opacity-80">
                <Image
                  source={{ uri: fileUrl(item.photoUrl) }}
                  style={{ width: 54, height: 54, borderRadius: 27 }}
                />
              </Pressable>
            ) : (
              <View
                style={{ backgroundColor: tints.blue.tile }}
                className="h-14 w-14 items-center justify-center rounded-full">
                <Text style={{ color: tints.blue.fg }} className="text-lg font-bold">
                  {item.firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View className="ml-3.5 flex-1">
              <Text style={{ color: colors.text }} className="text-[17px] font-bold">
                {patientFullName(item)}
              </Text>
              {(patientDisplayPhone(item.phone) || item.age) ? (
                <Text style={{ color: colors.textMuted }} className="mt-1 text-[14px] font-medium">
                  {[
                    patientDisplayPhone(item.phone),
                    item.age ? `${item.age} ${t('home.ageSuffix')}` : '',
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </Text>
              ) : null}
            </View>

            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => navigation.navigate('PatientForm', { id: item.id })}
                hitSlop={10}
                style={{ backgroundColor: isDark ? '#1E3A8A' : colors.primarySoft }}
                className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
                <Edit3 size={19} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(item)}
                hitSlop={10}
                style={{ backgroundColor: isDark ? '#450A0A' : colors.dangerSoft }}
                className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
                <Trash2 size={19} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={Users}
            title={t('home.noPatients')}
            text={t('home.noPatientsDesc')}
            action={
              <Button
                label={t('home.newPatient')}
                icon={UserPlus}
                onPress={() => navigation.navigate('PatientForm')}
              />
            }
          />
        }
      />

      {/* Floating Action Button (FAB) */}
      <Pressable
        onPress={() => navigation.navigate('PatientForm')}
        accessibilityRole="button"
        accessibilityLabel={t('home.newPatient')}
        style={{
          bottom: Math.max(insets.bottom, 20) + 32,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 6,
        }}
        className="absolute right-5 flex-row items-center rounded-full bg-primary px-5 py-3.5 active:opacity-90">
        <UserPlus size={22} color="#ffffff" strokeWidth={2.4} />
        <Text className="ml-2.5 text-[16px] font-bold text-white">
          {t('home.newPatient')}
        </Text>
      </Pressable>

      {viewPhotoUri && (
        <ImageViewer
          uris={[viewPhotoUri]}
          index={0}
          onClose={() => setViewPhotoUri(null)}
        />
      )}
    </SafeAreaView>
  );
}
