import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Bell,
  Brain,
  Calendar,
  ChevronDown,
  ChevronRight,
  Pill,
  Plus,
  Search,
  Stethoscope,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { patientsApi } from '../api/services';
import { Button, CountBadge, EmptyState, ErrorBanner, IconTile } from '../components/ui';
import { firstNameOf, useAuth } from '../context/AuthContext';
import { patientFullName, usePatient } from '../context/PatientContext';
import { colors, tints, type TintName } from '../theme';
import { useFocusData } from '../utils/hooks';

interface HomeRow {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tint: TintName;
  cardBg: string;
  count: number;
  onPress: () => void;
}

export function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { patient, patients, loading: loadingPatients, refresh: refreshPatients } = usePatient();

  const {
    data: dashboard,
    refreshing,
    error,
    reload,
  } = useFocusData(async () => {
    if (!patient) {
      return null;
    }
    return patientsApi.dashboard(patient.id);
  }, [patient?.id]);

  const onRefresh = async () => {
    await refreshPatients();
    await reload();
  };

  const greetingName =
    firstNameOf(user?.fullName) || patient?.firstName || 'İbrahim';

  const rows: HomeRow[] = [
    {
      key: 'complaints',
      title: 'Şikayətlər',
      subtitle: 'Şikayətlər, müşahidələr',
      icon: Users,
      tint: 'blue',
      cardBg: '#F4F8FE',
      count: dashboard?.complaintCount ?? patient?.complaintCount ?? 0,
      onPress: () => navigation.navigate('RecordList', { kind: 'complaint' }),
    },
    {
      key: 'diagnoses',
      title: 'Diaqnoz',
      subtitle: 'Diaqnoz sənədləri',
      icon: Stethoscope,
      tint: 'green',
      cardBg: '#F2FBF6',
      count: dashboard?.diagnosisCount ?? patient?.diagnosisCount ?? 0,
      onPress: () => navigation.navigate('RecordList', { kind: 'diagnosis' }),
    },
    {
      key: 'treatments',
      title: 'Müalicə',
      subtitle: 'Müalicə planları, reseptlər',
      icon: Pill,
      tint: 'orange',
      cardBg: '#FEF7F1',
      count: dashboard?.treatmentCount ?? patient?.treatmentCount ?? 0,
      onPress: () => navigation.navigate('RecordList', { kind: 'treatment' }),
    },
    {
      key: 'ai',
      title: 'AI',
      subtitle: 'AI ilə bağlı sənədlər, qeydlər',
      icon: Brain,
      tint: 'purple',
      cardBg: '#F7F4FE',
      count:
        dashboard?.aiDocumentCount ||
        (dashboard
          ? dashboard.complaintCount + dashboard.diagnosisCount + dashboard.treatmentCount
          : 0),
      onPress: () => navigation.navigate('Ai'),
    },
    {
      key: 'calendar',
      title: 'Təqvim və müayinələr',
      subtitle: 'Görüşlər, xatırlatmalar',
      icon: Calendar,
      tint: 'blue',
      cardBg: '#F4F8FE',
      count: dashboard?.appointmentCount ?? patient?.appointmentCount ?? 0,
      onPress: () => navigation.navigate('Calendar'),
    },
  ];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Top Greeting Header */}
        <View className="flex-row items-center justify-between px-5 pt-3 pb-3">
          <View className="flex-1 pr-3">
            <Text className="text-[26px] font-bold text-ink" numberOfLines={1}>
              Salam, {greetingName}!
            </Text>
            {patients.length > 0 && (
              <Pressable
                onPress={() => navigation.navigate('Patients')}
                hitSlop={8}
                className="mt-1 flex-row items-center self-start rounded-full bg-field px-2.5 py-1">
                <Text className="text-xs font-medium text-ink-muted" numberOfLines={1}>
                  Pasiyent: {patientFullName(patient)}
                </Text>
                <ChevronDown size={13} color={colors.textMuted} style={{ marginLeft: 3 }} />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => navigation.navigate('Calendar')}
            hitSlop={10}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-field">
            <Bell size={22} color={colors.text} />
          </Pressable>
        </View>

        {/* Search bar ("Sənəd axtar...") */}
        <Pressable
          onPress={() =>
            navigation.navigate('Tabs', {
              screen: 'Search',
            })
          }
          className="mx-5 mb-5 flex-row items-center rounded-xl bg-field px-3.5 py-3">
          <Search size={18} color={colors.textLight} />
          <Text className="ml-2.5 text-[15px] text-ink-light">Sənəd axtar...</Text>
        </Pressable>

        {error && <ErrorBanner message={error} onRetry={onRefresh} />}

        {!loadingPatients && !patient ? (
          <EmptyState
            icon={UserPlus}
            title="Pasiyent seçilməyib"
            text="Tibbi qeydləri, şikayətləri və müayinələri idarə etmək üçün ilk pasiyenti əlavə edin."
            action={
              <Button
                label="Yeni pasiyent əlavə et"
                icon={Plus}
                onPress={() => navigation.navigate('PatientForm')}
              />
            }
          />
        ) : (
          <View className="px-5">
            {rows.map(r => (
              <Pressable
                key={r.key}
                onPress={r.onPress}
                style={{
                  backgroundColor: r.cardBg,
                  borderColor: tints[r.tint].tile,
                }}
                className="mb-3.5 flex-row items-center rounded-2xl border p-4 active:opacity-85">
                <IconTile icon={r.icon} tint={r.tint} size={50} iconSize={24} variant="tile" />
                <View className="ml-3.5 flex-1">
                  <Text className="text-[16px] font-bold text-ink">{r.title}</Text>
                  <Text className="mt-0.5 text-[13px] text-ink-muted" numberOfLines={1}>
                    {r.subtitle}
                  </Text>
                </View>
                <CountBadge count={r.count} tint={r.tint} />
                <ChevronRight
                  size={18}
                  color={colors.textLight}
                  style={{ marginLeft: 8 }}
                />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

