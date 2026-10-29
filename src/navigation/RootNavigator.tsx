import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Home, Search, User } from 'lucide-react-native';
import { Loading } from '../components/ui';
import { useAuth } from '../context/AuthContext';
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
import { HomeScreen } from '../screens/HomeScreen';
import { PatientFormScreen } from '../screens/PatientFormScreen';
import { PatientsScreen } from '../screens/PatientsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RecordDetailScreen } from '../screens/RecordDetailScreen';
import { RecordFormScreen } from '../screens/RecordFormScreen';
import { RecordListScreen } from '../screens/RecordListScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { colors } from '../theme';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 12);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 56 + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          paddingHorizontal: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Ana səhifə',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{
          title: 'Sənədlər',
          tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Axtarış',
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { ready, user } = useAuth();

  if (!ready) {
    return <Loading />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
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
            <Stack.Screen name="RecordList" component={RecordListScreen} />
            <Stack.Screen name="RecordForm" component={RecordFormScreen} />
            <Stack.Screen name="RecordDetail" component={RecordDetailScreen} />
            <Stack.Screen name="Calendar" component={CalendarScreen} />
            <Stack.Screen name="AppointmentForm" component={AppointmentFormScreen} />
            <Stack.Screen name="Ai" component={AiScreen} />
            <Stack.Screen name="Patients" component={PatientsScreen} />
            <Stack.Screen name="PatientForm" component={PatientFormScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

