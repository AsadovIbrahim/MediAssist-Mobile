import React from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Bell,
  Brain,
  Calendar,
  ChevronRight,
  FlaskConical,
  Pill,
  Plus,
  Stethoscope,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { fileUrl } from '../api/client';
import { diagnosesApi, patientsApi } from '../api/services';
import { Button, CountBadge, EmptyState, ErrorBanner, IconTile } from '../components/ui';
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

export function PatientDashboardScreen() {
  const navigation = useNavigation();
  const { patient, loading: loadingPatients, refresh: refreshPatients } = usePatient();

  const {
    data: dashboardData,
    refreshing,
    error,
    reload,
  } = useFocusData(async () => {
    if (!patient) {
      return null;
    }
    const [dash, allDiagnoses] = await Promise.all([
      patientsApi.dashboard(patient.id),
      diagnosesApi.list(patient.id).catch(() => []),
    ]);
    const examCount = allDiagnoses.filter(d => d.description?.startsWith('[Müayinə]')).length;
    const diagCount = allDiagnoses.filter(d => !d.description?.startsWith('[Müayinə]')).length;
    return {
      dash,
      examCount,
      diagCount,
    };
  }, [patient?.id]);

  const onRefresh = async () => {
    await refreshPatients();
    await reload();
  };

  const rows: HomeRow[] = [
    {
      key: 'complaints',
      title: 'Şikayətlər',
      subtitle: 'Şikayətlər, müşahidələr',
      icon: Users,
      tint: 'blue',
      cardBg: '#F4F8FE',
      count: dashboardData?.dash?.complaintCount ?? patient?.complaintCount ?? 0,
      onPress: () => navigation.navigate('RecordList', { kind: 'complaint' }),
    },
    {
      key: 'examinations',
      title: 'Müayinələr',
      subtitle: 'Laboratoriya, analizlər və sənədlər',
      icon: FlaskConical,
      tint: 'purple',
      cardBg: '#F7F4FE',
      count: dashboardData?.examCount ?? 0,
      onPress: () => navigation.navigate('RecordList', { kind: 'examination' }),
    },
    {
      key: 'diagnoses',
      title: 'Diaqnoz',
      subtitle: 'Diaqnoz sənədləri',
      icon: Stethoscope,
      tint: 'green',
      cardBg: '#F2FBF6',
      count: dashboardData?.diagCount ?? dashboardData?.dash?.diagnosisCount ?? patient?.diagnosisCount ?? 0,
      onPress: () => navigation.navigate('RecordList', { kind: 'diagnosis' }),
    },
    {
      key: 'treatments',
      title: 'Müalicə',
      subtitle: 'Müalicə planları, reseptlər',
      icon: Pill,
      tint: 'orange',
      cardBg: '#FEF7F1',
      count: dashboardData?.dash?.treatmentCount ?? patient?.treatmentCount ?? 0,
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
        dashboardData?.dash?.aiDocumentCount ||
        (dashboardData?.dash
          ? dashboardData.dash.complaintCount +
            (dashboardData.dash.diagnosisCount ?? 0) +
            dashboardData.dash.treatmentCount
          : 0),
      onPress: () => navigation.navigate('Ai'),
    },
    {
      key: 'calendar',
      title: 'Təqvim',
      subtitle: 'Görüşlər, xatırlatmalar',
      icon: Calendar,
      tint: 'blue',
      cardBg: '#F4F8FE',
      count: dashboardData?.dash?.appointmentCount ?? patient?.appointmentCount ?? 0,
      onPress: () => navigation.navigate('Calendar'),
    },
  ];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Top Header with Back button */}
        <View className="flex-row items-center justify-between px-5 pt-3 pb-1">
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={14}
            className="h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface active:bg-field shadow-sm">
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Calendar')}
            hitSlop={12}
            className="h-11 w-11 items-center justify-center rounded-2xl bg-field active:bg-line">
            <Bell size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Centered Patient Profile (Photo, Name, Phone & Age) */}
        {patient && (
          <View className="mt-2 mb-6 items-center justify-center">
            <View className="relative">
              {patient.photoUrl ? (
                <Image
                  source={{ uri: fileUrl(patient.photoUrl) }}
                  style={{
                    width: 86,
                    height: 86,
                    borderRadius: 43,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 86,
                    height: 86,
                    borderRadius: 43,
                    backgroundColor: tints.blue.tile,
                  }}
                  className="items-center justify-center">
                  <Text style={{ color: tints.blue.fg }} className="text-3xl font-bold">
                    {patient.firstName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {/* Centered Name and Surname */}
            <Text className="mt-2.5 text-center text-[22px] font-bold text-ink">
              {patientFullName(patient)}
            </Text>
            <Text className="mt-0.5 text-center text-[15px] font-medium text-ink-muted">
              {patient.phone}
              {patient.age ? ` • ${patient.age} yaş` : ''}
            </Text>
          </View>
        )}

        {error && <ErrorBanner message={error} onRetry={onRefresh} />}

        {!loadingPatients && !patient ? (
          <EmptyState
            icon={UserPlus}
            title="Pasiyent seçilməyib"
            text="Tibbi qeydləri, şikayətləri və müayinələri idarə etmək üçün pasiyenti seçin."
            action={
              <Button
                label="Pasiyentlər siyahısına qayıt"
                onPress={() => navigation.goBack()}
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
                className="mb-4 flex-row items-center rounded-2xl border p-4 active:opacity-85 shadow-sm">
                <IconTile icon={r.icon} tint={r.tint} size={54} iconSize={26} variant="tile" />
                <View className="ml-4 flex-1">
                  <Text className="text-[18px] font-bold text-ink">{r.title}</Text>
                  <Text className="mt-0.5 text-[14px] font-medium text-ink-muted" numberOfLines={1}>
                    {r.subtitle}
                  </Text>
                </View>
                <CountBadge count={r.count} tint={r.tint} />
                <ChevronRight
                  size={22}
                  color={colors.textLight}
                  style={{ marginLeft: 10 }}
                />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

