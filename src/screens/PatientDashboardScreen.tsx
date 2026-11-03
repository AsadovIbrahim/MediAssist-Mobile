import React, { useState } from 'react';
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
import { ImageViewer } from '../components/media';
import { OfflineBanner } from '../components/OfflineBanner';
import { Button, EmptyState, ErrorBanner, IconTile } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { patientFullName, usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';
import { type TintName } from '../theme';
import { useFocusData } from '../utils/hooks';
import { offlineStorage } from '../utils/offlineStorage';

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
  const { t } = useLanguage();
  const { isDark, colors, tints } = useTheme();
  const { patient, loading: loadingPatients, refresh: refreshPatients } = usePatient();
  const [showViewer, setShowViewer] = useState(false);

  const {
    data: dashboardData,
    refreshing,
    error,
    reload,
  } = useFocusData(async () => {
    if (!patient) {
      return null;
    }
    const [
      dash,
      allDiagnoses,
      localComplaints,
      localExams,
      localDiagnoses,
      localTreatments,
    ] = await Promise.all([
      patientsApi.dashboard(patient.id).catch(() => null),
      diagnosesApi.list(patient.id).catch(() => []),
      offlineStorage.getRecords(patient.id, 'complaint'),
      offlineStorage.getRecords(patient.id, 'examination'),
      offlineStorage.getRecords(patient.id, 'diagnosis'),
      offlineStorage.getRecords(patient.id, 'treatment'),
    ]);

    const pendingComplaints = (localComplaints || []).filter(r =>
      r.id.startsWith('local_'),
    ).length;
    const complaintCount =
      dash != null
        ? dash.complaintCount + pendingComplaints
        : localComplaints?.length ?? patient.complaintCount ?? 0;

    const pendingExams = (localExams || []).filter(r =>
      r.id.startsWith('local_'),
    ).length;
    const serverExams = allDiagnoses.filter(d =>
      d.description?.startsWith('[Müayinə]'),
    ).length;
    const examCount =
      allDiagnoses.length > 0
        ? serverExams + pendingExams
        : localExams?.length ?? 0;

    const pendingDiags = (localDiagnoses || []).filter(r =>
      r.id.startsWith('local_'),
    ).length;
    const serverDiags = allDiagnoses.filter(
      d => !d.description?.startsWith('[Müayinə]'),
    ).length;
    const diagCount =
      allDiagnoses.length > 0
        ? serverDiags + pendingDiags
        : localDiagnoses?.length ?? dash?.diagnosisCount ?? patient.diagnosisCount ?? 0;

    const pendingTreatments = (localTreatments || []).filter(r =>
      r.id.startsWith('local_'),
    ).length;
    const treatmentCount =
      dash != null
        ? dash.treatmentCount + pendingTreatments
        : localTreatments?.length ?? patient.treatmentCount ?? 0;

    return {
      dash,
      complaintCount,
      examCount,
      diagCount,
      treatmentCount,
    };
  }, [patient?.id]);

  const onRefresh = async () => {
    await refreshPatients();
    await reload();
  };

  const rows: HomeRow[] = [
    {
      key: 'complaints',
      title: t('dashboard.complaints'),
      subtitle: t('dashboard.complaintsDesc'),
      icon: Users,
      tint: 'blue',
      cardBg: '#F4F8FE',
      count: dashboardData?.complaintCount ?? patient?.complaintCount ?? 0,
      onPress: () => navigation.navigate('RecordList', { kind: 'complaint' }),
    },
    {
      key: 'examinations',
      title: t('dashboard.examinations'),
      subtitle: t('dashboard.examinationsDesc'),
      icon: FlaskConical,
      tint: 'purple',
      cardBg: '#F7F4FE',
      count: dashboardData?.examCount ?? 0,
      onPress: () => navigation.navigate('RecordList', { kind: 'examination' }),
    },
    {
      key: 'diagnoses',
      title: t('dashboard.diagnoses'),
      subtitle: t('dashboard.diagnosesDesc'),
      icon: Stethoscope,
      tint: 'green',
      cardBg: '#F2FBF6',
      count:
        dashboardData?.diagCount ??
        dashboardData?.dash?.diagnosisCount ??
        patient?.diagnosisCount ??
        0,
      onPress: () => navigation.navigate('RecordList', { kind: 'diagnosis' }),
    },
    {
      key: 'treatments',
      title: t('dashboard.treatments'),
      subtitle: t('dashboard.treatmentsDesc'),
      icon: Pill,
      tint: 'orange',
      cardBg: '#FEF7F1',
      count: dashboardData?.treatmentCount ?? patient?.treatmentCount ?? 0,
      onPress: () => navigation.navigate('RecordList', { kind: 'treatment' }),
    },
    {
      key: 'ai',
      title: t('dashboard.ai'),
      subtitle: t('dashboard.aiDesc'),
      icon: Brain,
      tint: 'purple',
      cardBg: '#F7F4FE',
      count:
        dashboardData?.dash?.aiDocumentCount ||
        (dashboardData
          ? (dashboardData.complaintCount ?? 0) +
            (dashboardData.diagCount ?? 0) +
            (dashboardData.treatmentCount ?? 0)
          : 0),
      onPress: () => navigation.navigate('Ai'),
    },
    {
      key: 'calendar',
      title: t('dashboard.calendar'),
      subtitle: t('dashboard.calendarDesc'),
      icon: Calendar,
      tint: 'blue',
      cardBg: '#F4F8FE',
      count: dashboardData?.dash?.appointmentCount ?? patient?.appointmentCount ?? 0,
      onPress: () => navigation.navigate('Calendar'),
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Top Header with Back button */}
        <View className="flex-row items-center justify-between px-5 pt-3 pb-1">
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={14}
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75 shadow-sm">
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Calendar')}
            hitSlop={12}
            style={{ backgroundColor: colors.field }}
            className="h-11 w-11 items-center justify-center rounded-2xl active:opacity-75">
            <Bell size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Centered Patient Profile (Photo, Name, Phone & Age) */}
        {patient && (
          <View className="mt-2 mb-6 items-center justify-center">
            <Pressable
              disabled={!patient.photoUrl}
              onPress={() => setShowViewer(true)}
              className="relative active:opacity-80">
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
            </Pressable>

            {/* Centered Name and Surname */}
            <Text style={{ color: colors.text }} className="mt-2.5 text-center text-[22px] font-bold">
              {patientFullName(patient)}
            </Text>
            <Text style={{ color: colors.textMuted }} className="mt-0.5 text-center text-[15px] font-medium">
              {patient.phone}
              {patient.age ? ` • ${patient.age} ${t('home.ageSuffix')}` : ''}
            </Text>
          </View>
        )}

        <OfflineBanner onSyncComplete={onRefresh} />
        {error && <ErrorBanner message={error} onRetry={onRefresh} />}

        {!loadingPatients && !patient ? (
          <EmptyState
            icon={UserPlus}
            title={t('dashboard.noPatient')}
            text={t('dashboard.noPatientDesc')}
            action={
              <Button
                label={t('dashboard.backToList')}
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
                  backgroundColor: isDark ? colors.surface : r.cardBg,
                  borderColor: isDark ? colors.border : tints[r.tint].tile,
                }}
                className="mb-4 flex-row items-center rounded-2xl border p-4 active:opacity-85 shadow-sm">
                <IconTile icon={r.icon} tint={r.tint} size={54} iconSize={26} variant="tile" />
                <View className="ml-4 flex-1">
                  <Text style={{ color: colors.text }} className="text-[18px] font-bold">{r.title}</Text>
                  <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[14px] font-medium" numberOfLines={1}>
                    {r.subtitle}
                  </Text>
                </View>
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

      {patient?.photoUrl && (
        <ImageViewer
          uris={[fileUrl(patient.photoUrl) || '']}
          index={showViewer ? 0 : null}
          onClose={() => setShowViewer(false)}
        />
      )}
    </SafeAreaView>
  );
}

