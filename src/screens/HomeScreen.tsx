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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Bell,
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
  SearchBar,
} from '../components/ui';
import { firstNameOf, useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { patientFullName, usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';

export function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { colors, tints, isDark } = useTheme();
  const {
    patients,
    loading,
    error,
    refresh,
    select,
  } = usePatient();
  const [search, setSearch] = useState('');
  const [viewPhotoUri, setViewPhotoUri] = useState<string | null>(null);

  const greetingName =
    firstNameOf(user?.fullName) || 'İbrahim';

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
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1">
      {/* Top Greeting Header */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-3">
        <View className="flex-1 pr-3">
          <Text style={{ color: colors.text }} className="text-[28px] font-bold" numberOfLines={1}>
            {t('home.greeting')}, {greetingName}!
          </Text>
          <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[15px] font-medium">
            {t('home.patientList')}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('Calendar')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.calendar')}
          style={{ backgroundColor: colors.field, borderColor: colors.border }}
          className="h-12 w-12 items-center justify-center rounded-2xl border active:opacity-70">
          <Bell size={24} color={colors.text} />
        </Pressable>
      </View>

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
              <Text style={{ color: colors.textMuted }} className="mt-1 text-[14px] font-medium">
                {item.phone}
                {item.age ? ` • ${item.age} ${t('home.ageSuffix')}` : ''}
              </Text>
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
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 6,
        }}
        className="absolute bottom-6 right-5 flex-row items-center rounded-full bg-primary px-5 py-3.5 active:opacity-90">
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
