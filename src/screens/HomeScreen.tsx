import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Bell,
  ChevronRight,
  FolderOpen,
  NotebookPen,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { IconTile } from '../components/ui';
import { OfflineBanner } from '../components/OfflineBanner';
import { firstNameOf, useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { type TintName } from '../theme';

interface HomeDashboardCard {
  key: string;
  title: string;
  subtitle: string;
  icon: typeof Users;
  tint: TintName;
  cardBg: string;
  onPress: () => void;
}

export function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { colors, tints, isDark } = useTheme();

  const greetingName =
    firstNameOf(user?.fullName) || 'İbrahim';

  const cards: HomeDashboardCard[] = [
    {
      key: 'patients',
      title: t('home.patientsCard'),
      subtitle: t('home.patientsCardDesc'),
      icon: Users,
      tint: 'blue',
      cardBg: '#F4F8FE',
      onPress: () => navigation.navigate('Patients'),
    },
    {
      key: 'notes',
      title: t('home.notesCard'),
      subtitle: t('home.notesCardDesc'),
      icon: NotebookPen,
      tint: 'orange',
      cardBg: '#FEF7F1',
      onPress: () => navigation.navigate('Notes'),
    },
    {
      key: 'folder',
      title: t('home.folderCard'),
      subtitle: t('home.folderCardDesc'),
      icon: FolderOpen,
      tint: 'purple',
      cardBg: '#F7F4FE',
      onPress: () => navigation.navigate('Folder'),
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 96 }}>
        {/* Top Greeting Header */}
        <View className="flex-row items-center justify-between px-5 pt-3 pb-3">
          <View className="flex-1 pr-3">
            <Text style={{ color: colors.text }} className="text-[28px] font-bold" numberOfLines={1}>
              {t('home.greeting')}, {greetingName}!
            </Text>
            <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[15px] font-medium">
              {t('home.dashboardSubtitle')}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Calendar')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.calendar')}
            style={{ backgroundColor: colors.field, borderColor: colors.border }}
            className="h-12 w-12 items-center justify-center rounded-2xl border active:opacity-70 shadow-sm">
            <Bell size={24} color={colors.text} />
          </Pressable>
        </View>

        <OfflineBanner />

        {/* 3 Main Dashboard Cards: Pasiyentlər, Qeyd, Qovluq */}
        <View className="px-5 pt-3">
          {cards.map(card => (
            <Pressable
              key={card.key}
              onPress={card.onPress}
              style={{
                backgroundColor: isDark ? colors.surface : card.cardBg,
                borderColor: isDark ? colors.border : tints[card.tint].tile,
              }}
              className="mb-4 flex-row items-center rounded-2xl border p-4 active:opacity-85 shadow-sm">
              <IconTile icon={card.icon} tint={card.tint} size={54} iconSize={26} variant="tile" />
              <View className="ml-4 flex-1">
                <Text style={{ color: colors.text }} className="text-[18px] font-bold">
                  {card.title}
                </Text>
                <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[14px] font-medium" numberOfLines={1}>
                  {card.subtitle}
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
      </ScrollView>

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
    </SafeAreaView>
  );
}
