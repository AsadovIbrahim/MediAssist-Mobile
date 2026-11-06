import React, { useMemo, useState } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Home, Search, User } from 'lucide-react-native';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { AiScreen } from '../screens/AiScreen';
import { AppointmentFormScreen } from '../screens/AppointmentFormScreen';
import {
  ForgotPasswordScreen,
  LoginScreen,
  OtpVerificationScreen,
  RegisterScreen,
  ResetPasswordNewScreen,
  ResetPasswordOtpScreen,
} from '../screens/AuthScreens';
import { CalendarScreen } from '../screens/CalendarScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { FolderScreen } from '../screens/FolderScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { PatientDashboardScreen } from '../screens/PatientDashboardScreen';
import { PatientFormScreen } from '../screens/PatientFormScreen';
import { PatientsScreen } from '../screens/PatientsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RecordDetailScreen } from '../screens/RecordDetailScreen';
import { RecordFormScreen } from '../screens/RecordFormScreen';
import { RecordListScreen } from '../screens/RecordListScreen';
import { SearchScreen } from '../screens/SearchScreen';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 12);
  const { t } = useLanguage();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64 + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          paddingHorizontal: 8,
        },
        tabBarLabelStyle: {
          fontFamily: 'RedditSans',
          fontSize: 13,
          fontWeight: '700',
          marginTop: 2,
        },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: t('tab.home'),
          tabBarIcon: ({ color }) => <Home size={25} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tab.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{
          title: t('tab.documents'),
          tabBarIcon: ({ color }) => <FileText size={25} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: t('tab.search'),
          tabBarIcon: ({ color }) => <Search size={25} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: t('tab.profile'),
          tabBarIcon: ({ color }) => <User size={25} color={color} strokeWidth={2.2} />,
        }}
      />
    </Tab.Navigator>
  );
}

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['mediassist://'],
  config: {
    screens: {
      Calendar: 'calendar',
      AppointmentForm: 'appointment',
      PatientDashboard: 'patient-dashboard',
    },
  },
};

export function RootNavigator() {
  const { ready, user } = useAuth();
  const { isDark, colors } = useTheme();
  const [splashDone, setSplashDone] = useState(false);

  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        primary: colors.primary,
      },
    };
  }, [isDark, colors]);

  if (!splashDone || !ready) {
    return <AnimatedSplash ready={ready} onFinish={() => setSplashDone(true)} />;
  }

  return (
    <NavigationContainer linking={linking} theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPasswordOtp" component={ResetPasswordOtpScreen} />
            <Stack.Screen name="ResetPasswordNew" component={ResetPasswordNewScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Tabs" component={MainTabs} />
            <Stack.Screen name="PatientDashboard" component={PatientDashboardScreen} />
            <Stack.Screen name="RecordList" component={RecordListScreen} />
            <Stack.Screen name="RecordForm" component={RecordFormScreen} />
            <Stack.Screen name="RecordDetail" component={RecordDetailScreen} />
            <Stack.Screen name="Calendar" component={CalendarScreen} />
            <Stack.Screen name="AppointmentForm" component={AppointmentFormScreen} />
            <Stack.Screen name="Ai" component={AiScreen} />
            <Stack.Screen name="Patients" component={PatientsScreen} />
            <Stack.Screen name="PatientForm" component={PatientFormScreen} />
            <Stack.Screen name="Notes" component={NotesScreen} />
            <Stack.Screen name="Folder" component={FolderScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
