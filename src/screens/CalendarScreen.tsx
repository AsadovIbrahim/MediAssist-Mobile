import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Calendar as CalendarIcon,
  FileText,
  FlaskConical,
  Home,
  MoreVertical,
  Search,
  Stethoscope,
  User,
} from 'lucide-react-native';
import { appointmentsApi, patientsApi } from '../api/services';
import type { Appointment, Patient } from '../api/types';
import { MonthCalendar } from '../components/MonthCalendar';
import { OfflineBanner } from '../components/OfflineBanner';
import {
  AddButton,
  Card,
  CountBadge,
  EmptyState,
  ErrorBanner,
  IconTile,
  ScreenHeader,
} from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';
import { localizeAppointmentTitle } from '../features/records';
import type { RootScreenProps, TabParamList } from '../navigation/types';
import { type TintName } from '../theme';
import {
  dayKey,
  formatDate,
  formatTime,
  isSameDay,
  parseDate,
  toApiDate,
} from '../utils/format';
import { useFocusData } from '../utils/hooks';
import { cancelAppointmentNotification, syncUpcomingAppointments } from '../utils/notifications';

export function CalendarScreen({ navigation, route }: RootScreenProps<'Calendar'>) {
  const { patient, patients, select } = usePatient();
  const { language, t } = useLanguage();
  const { colors, tints } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 12);

  const routeDate = route.params?.date;
  const routePatientId = route.params?.patientId;

  const [selected, setSelected] = useState(() => {
    if (routeDate) {
      const d = parseDate(routeDate);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  // Auto-select patient from notification or deep link params
  useEffect(() => {
    if (routePatientId && (!patient || patient.id !== routePatientId)) {
      select(routePatientId);
    }
  }, [routePatientId]);

  // Update calendar selection if route date params change
  useEffect(() => {
    if (routeDate) {
      const d = parseDate(routeDate);
      if (!isNaN(d.getTime())) {
        setSelected(d);
        if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) {
          setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
        }
      }
    }
  }, [routeDate]);

  const {
    data: appointments,
    refreshing,
    error,
    reload,
  } = useFocusData(async () => {
    let targetList: Patient[] = [];
    if (patients && patients.length > 0) {
      targetList = patients;
    } else {
      const list = await patientsApi.list().catch(() => []);
      targetList = list;
    }
    if (targetList.length === 0 && patient) {
      targetList = [patient];
    }
    if (targetList.length === 0) {
      return [];
    }
    const start = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);

    const allAppointments: Appointment[] = [];
    await Promise.all(
      targetList.map(async p => {
        try {
          const list = await appointmentsApi.range(p.id, toApiDate(start), toApiDate(end));
          for (const a of list) {
            allAppointments.push(a);
          }
        } catch {}
      }),
    );
    syncUpcomingAppointments(allAppointments);
    return allAppointments;
  }, [patient?.id, patients?.length, month.getFullYear(), month.getMonth()]);

  useEffect(() => {
    reload();
  }, [patient?.id, patients?.length]);

  const markers = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of appointments ?? []) {
      const k = dayKey(parseDate(a.dateTime));
      map[k] = a.type === 'LabTest' ? tints.purple.fg : colors.primary;
    }
    return map;
  }, [appointments]);

  const dayItems = useMemo(
    () =>
      (appointments ?? [])
        .filter(a => isSameDay(parseDate(a.dateTime), selected))
        .sort((a, b) => parseDate(a.dateTime).getTime() - parseDate(b.dateTime).getTime()),
    [appointments, selected],
  );

  const onMenu = (item: Appointment) => {
    Alert.alert(
      localizeAppointmentTitle(item.title, t),
      `${formatDate(item.dateTime, language)} • ${formatTime(item.dateTime)}`,
      [
        { text: t('common.close') || 'Ləğv et', style: 'cancel' },
        {
          text: t('common.edit') || 'Düzəliş et',
          onPress: () => navigation.navigate('AppointmentForm', { appointment: item }),
        },
        {
          text: t('common.delete') || 'Sil',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('common.delete') || 'Sil',
              'Bu görüş və ya müayinəni silmək istədiyinizə əminsiniz?',
              [
                { text: t('common.cancel') || 'Ləğv et', style: 'cancel' },
                {
                  text: t('common.delete') || 'Sil',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await cancelAppointmentNotification(item.id);
                      await appointmentsApi.remove(item.id);
                      await reload();
                    } catch (e: any) {
                      Alert.alert(t('common.error'), e?.message || 'Xəta baş verdi');
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const isToday = isSameDay(selected, new Date());
  const sectionLabel = isToday ? t('calendar.today') : formatDate(selected, language);

  const goTab = (screen: keyof TabParamList) => {
    navigation.navigate('Tabs', { screen });
  };

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1">
      <ScreenHeader
        title={t('calendar.title')}
        right={
          <AddButton
            label={t('common.add')}
            onPress={() =>
              navigation.navigate('AppointmentForm', { date: toApiDate(selected) })
            }
          />
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
        {error && <ErrorBanner message={error} onRetry={reload} />}
        <OfflineBanner onSyncComplete={reload} />

        <Card className="mx-4 mt-1 py-4">
          <MonthCalendar
            month={month}
            selected={selected}
            onSelect={d => {
              setSelected(d);
              if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) {
                setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
              }
            }}
            onMonthChange={setMonth}
            markers={markers}
          />
        </Card>

        <View className="mt-5 mb-3 flex-row items-center justify-between px-5">
          <Text style={{ color: colors.text }} className="text-[18px] font-bold">{sectionLabel}</Text>
          <CountBadge count={dayItems.length} tint="blue" />
        </View>

        {dayItems.length === 0 ? (
          <EmptyState
            icon={CalendarIcon}
            title={t('calendar.noAppointments')}
            text={t('calendar.noAppointmentsDesc')}
          />
        ) : (
          dayItems.map(item => {
            const visual: { icon: typeof Stethoscope; tint: TintName } =
              item.type === 'LabTest'
                ? { icon: FlaskConical, tint: 'purple' }
                : item.type === 'Other'
                  ? { icon: CalendarIcon, tint: 'green' }
                  : { icon: Stethoscope, tint: 'blue' };
            return (
              <Card
                key={item.id}
                onPress={() => navigation.navigate('AppointmentForm', { appointment: item })}
                className="mx-4 mb-3.5 flex-row items-center px-4 py-3.5">
                <Text style={{ color: colors.text }} className="w-[48px] text-[15px] font-bold">
                  {formatTime(item.dateTime)}
                </Text>
                <View className="mx-2.5">
                  <IconTile icon={visual.icon} tint={visual.tint} size={36} iconSize={20} variant="soft" />
                </View>
                <View className="flex-1 justify-center">
                  <Text style={{ color: colors.text }} className="text-[16px] font-bold" numberOfLines={1}>
                    {localizeAppointmentTitle(item.title, t)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onMenu(item)}
                  hitSlop={12}
                  style={{ backgroundColor: colors.field }}
                  className="h-10 w-10 items-center justify-center rounded-xl active:opacity-75">
                  <MoreVertical size={20} color={colors.textMuted} />
                </Pressable>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Bottom tab bar matching the mockup */}
      <View
        style={{
          paddingBottom: bottomPadding,
          paddingTop: 8,
          paddingHorizontal: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        }}
        className="flex-row">
        <TabShortcut icon={Home} label={t('tab.home')} active onPress={() => goTab('Home')} />
        <TabShortcut icon={FileText} label={t('tab.documents')} onPress={() => goTab('Documents')} />
        <TabShortcut icon={Search} label={t('tab.search')} onPress={() => goTab('Search')} />
        <TabShortcut icon={User} label={t('tab.profile')} onPress={() => goTab('Profile')} />
      </View>
    </SafeAreaView>
  );
}

function TabShortcut({
  icon: Icon,
  label,
  active,
  onPress,
}: {
  icon: typeof Home;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const color = active ? colors.primary : colors.textLight;
  return (
    <Pressable onPress={onPress} className="flex-1 items-center py-1">
      <Icon size={22} color={color} />
      <Text
        style={{ color }}
        className={`mt-1 text-[11px] ${active ? 'font-semibold' : 'font-normal'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

