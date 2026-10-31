import React, { useMemo, useState } from 'react';
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
import { appointmentsApi } from '../api/services';
import type { Appointment } from '../api/types';
import { MonthCalendar } from '../components/MonthCalendar';
import {
  AddButton,
  Card,
  CountBadge,
  EmptyState,
  ErrorBanner,
  IconTile,
  ScreenHeader,
} from '../components/ui';
import { usePatient } from '../context/PatientContext';
import type { RootScreenProps, TabParamList } from '../navigation/types';
import { colors, tints, type TintName } from '../theme';
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

export function CalendarScreen({ navigation }: RootScreenProps<'Calendar'>) {
  const { patient } = usePatient();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 12);
  const [selected, setSelected] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  const {
    data: appointments,
    refreshing,
    error,
    reload,
  } = useFocusData(async () => {
    if (!patient) {
      return [];
    }
    const start = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
    const list = await appointmentsApi.range(patient.id, toApiDate(start), toApiDate(end));
    syncUpcomingAppointments(list);
    return list;
  }, [patient?.id, month.getFullYear(), month.getMonth()]);

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
    Alert.alert(item.title, `${formatDate(item.dateTime)} • ${formatTime(item.dateTime)}`, [
      { text: 'Bağla', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelAppointmentNotification(item.id);
            await appointmentsApi.remove(item.id);
            await reload();
          } catch (e) {
            Alert.alert('Xəta', (e as Error).message);
          }
        },
      },
    ]);
  };

  const isToday = isSameDay(selected, new Date());
  const sectionLabel = isToday ? 'Bu gün' : formatDate(selected);

  const goTab = (screen: keyof TabParamList) => {
    navigation.navigate('Tabs', { screen });
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <ScreenHeader
        title="Təqvim"
        right={
          <AddButton
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
          <Text className="text-[18px] font-bold text-ink">{sectionLabel}</Text>
          <CountBadge count={dayItems.length} tint="blue" />
        </View>

        {dayItems.length === 0 ? (
          <EmptyState
            icon={CalendarIcon}
            title="Bu tarixdə görüş yoxdur"
            text="Yeni görüş və ya xatırlatma əlavə edə bilərsiniz."
          />
        ) : (
          dayItems.map(item => {
            const visual: { icon: typeof Stethoscope; tint: TintName } =
              item.type === 'LabTest'
                ? { icon: FlaskConical, tint: 'purple' }
                : item.type === 'Other'
                  ? { icon: CalendarIcon, tint: 'green' }
                  : { icon: Stethoscope, tint: 'blue' };
            const subtitle =
              item.location || item.doctorSpecialty || item.notes || item.doctorName || '';

            return (
              <Card key={item.id} className="mx-4 mb-3.5 flex-row items-center px-4 py-4">
                <Text className="w-16 text-[16px] font-bold text-ink">
                  {formatTime(item.dateTime)}
                </Text>
                <IconTile icon={visual.icon} tint={visual.tint} size={50} iconSize={24} variant="soft" />
                <View className="ml-3.5 flex-1">
                  <Text className="text-[17px] font-bold text-ink" numberOfLines={1}>
                    {item.title}
                  </Text>
                  {!!subtitle && (
                    <Text className="mt-1 text-[14px] font-medium text-ink-muted" numberOfLines={1}>
                      {subtitle}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => onMenu(item)}
                  hitSlop={12}
                  className="h-10 w-10 items-center justify-center rounded-xl bg-field active:bg-line">
                  <MoreVertical size={20} color={colors.textMuted} />
                </Pressable>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Bottom tab bar matching the mockup */}
      <View
        style={{ paddingBottom: bottomPadding, paddingTop: 8, paddingHorizontal: 8 }}
        className="flex-row border-t border-line bg-surface">
        <TabShortcut icon={Home} label="Ana səhifə" active onPress={() => goTab('Home')} />
        <TabShortcut icon={FileText} label="Sənədlər" onPress={() => goTab('Documents')} />
        <TabShortcut icon={Search} label="Axtarış" onPress={() => goTab('Search')} />
        <TabShortcut icon={User} label="Profil" onPress={() => goTab('Profile')} />
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

