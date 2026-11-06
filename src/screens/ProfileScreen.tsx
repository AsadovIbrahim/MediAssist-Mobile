import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Bell,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  HelpCircle,
  Info,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  Moon,
  Phone,
  ShieldCheck,
  Stethoscope,
  X,
} from 'lucide-react-native';
import { http } from '../api/client';
import { authApi, patientsApi } from '../api/services';
import { Button, Card, IconTile, KeyboardScrollView } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { LANGUAGES, type LanguageCode, useLanguage } from '../context/LanguageContext';
import { usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';
import { useFocusData } from '../utils/hooks';
import { requestNotificationPermission } from '../utils/notifications';

const NOTIFICATIONS_STORAGE_KEY = 'mediassist.settings.notifications';
const LANGUAGE_STORAGE_KEY = 'mediassist.settings.language';

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const { patients } = usePatient();
  const { language, setLanguage, t, currentLanguageOption } = useLanguage();
  const { isDark, toggleTheme, colors, tints } = useTheme();

  // Settings State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Modal States
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);

  // Direct Password Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const savedNotif = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        if (savedNotif !== null) {
          setNotificationsEnabled(savedNotif === 'true');
        }
      } catch {
        // ignore fallback
      }
    })();
  }, []);

  const toggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, String(val));
    if (val) {
      const granted = await requestNotificationPermission();
      if (granted) {
        Alert.alert(
          'Bildirişlər aktiv edildi',
          'Təqvim qəbulları üçün vaxtında və 15 dəqiqə əvvəl səsli xatırlatma alacaqsınız.',
        );
      }
    } else {
      Alert.alert(
        'Bildirişlər deaktiv edildi',
        'Görüşlər üçün xatırlatma bildirişləri dayandırıldı.',
      );
    }
  };

  const handleLanguageSelect = async (code: LanguageCode) => {
    await setLanguage(code);
    setShowLangModal(false);
  };

  const handleDirectPasswordChange = async () => {
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert(t('common.attention'), t('password.errFill'));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('common.attention'), t('password.errLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.attention'), t('password.errMismatch'));
      return;
    }
    if (oldPassword === newPassword) {
      Alert.alert(t('common.attention'), t('password.errSame'));
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await http.post<{ message: string }>('auth/change-password', {
        oldPassword,
        newPassword,
      });

      setShowPasswordModal(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(t('password.successTitle'), res?.message || t('password.successMsg'));
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Dynamic live stats across all doctor patients
  const { data: stats } = useFocusData(async () => {
    let totalAppointments = 0;
    let totalRecords = 0;

    const list = patients.length ? patients : await patientsApi.list();

    const dashboards = await Promise.all(
      list.map(p => patientsApi.dashboard(p.id).catch(() => null)),
    );

    for (const d of dashboards) {
      if (d) {
        totalAppointments += d.appointmentCount || 0;
        totalRecords +=
          (d.complaintCount || 0) +
          (d.diagnosisCount || 0) +
          (d.treatmentCount || 0);
      }
    }

    return {
      totalPatients: list.length,
      totalAppointments,
      totalRecords,
    };
  }, [patients]);

  const doctorInitial = (user?.fullName ?? 'H')
    .replace(/^Dr\.?\s*/i, '')
    .charAt(0)
    .toUpperCase();

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1">
      <KeyboardScrollView className="flex-1 px-4 pt-3" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Screen Header */}
        <View className="mb-4 px-1">
          <Text style={{ color: colors.text }} className="text-[28px] font-bold">{t('profile.title')}</Text>
          <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[15px] font-medium">
            {t('profile.headerSubtitle')}
          </Text>
        </View>

        {/* Doctor Identity Card */}
        <Card className="mb-4 p-4">
          <View className="flex-row items-center">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Text className="text-2xl font-bold text-white">{doctorInitial}</Text>
            </View>
            <View className="ml-4 flex-1">
              <Text style={{ color: colors.text }} className="text-[20px] font-bold" numberOfLines={1}>
                {user?.fullName ?? t('profile.defaultDoctor')}
              </Text>
              <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[14px] font-medium" numberOfLines={1}>
                {user?.email}
              </Text>
              <View className="mt-1.5 flex-row items-center">
                <View
                  style={{ backgroundColor: isDark ? '#1E3A8A' : colors.primarySoft }}
                  className="rounded-full px-2.5 py-0.5">
                  <Text className="text-[12px] font-bold text-primary uppercase">
                    {t('profile.roleBadge')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View style={{ borderTopColor: colors.border }} className="mt-4 flex-row justify-between border-t pt-3.5">
            <View className="flex-1 items-center">
              <Text style={{ color: colors.text }} className="text-[20px] font-bold">
                {stats?.totalPatients ?? patients.length}
              </Text>
              <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[12px] font-semibold">{t('profile.patients')}</Text>
            </View>
            <View style={{ backgroundColor: colors.border }} className="h-9 w-px" />
            <View className="flex-1 items-center">
              <Text style={{ color: colors.text }} className="text-[20px] font-bold">
                {stats?.totalAppointments ?? 0}
              </Text>
              <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[12px] font-semibold">{t('profile.appointments')}</Text>
            </View>
            <View style={{ backgroundColor: colors.border }} className="h-9 w-px" />
            <View className="flex-1 items-center">
              <Text style={{ color: colors.text }} className="text-[20px] font-bold">
                {stats?.totalRecords ?? 0}
              </Text>
              <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[12px] font-semibold">{t('profile.records')}</Text>
            </View>
          </View>
        </Card>

        {/* SECTION 1: SETTINGS */}
        <Text style={{ color: colors.textMuted }} className="mb-2 px-1 text-[13px] font-bold uppercase tracking-wider">
          {t('profile.settings')}
        </Text>

        {/* Notifications Toggle */}
        <Card className="mb-2.5 flex-row items-center p-4">
          <IconTile icon={Bell} tint="blue" size={48} iconSize={24} variant="soft" />
          <View className="ml-3.5 flex-1">
            <Text style={{ color: colors.text }} className="text-[16px] font-bold">{t('profile.notifications')}</Text>
            <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[13px] font-medium">
              {t('profile.notificationsDesc')}
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: isDark ? '#334155' : '#CBD5E1', true: colors.primary }}
            thumbColor="#ffffff"
          />
        </Card>

        {/* Dark Mode Toggle */}
        <Card className="mb-2.5 flex-row items-center p-4">
          <IconTile icon={Moon} tint="purple" size={48} iconSize={24} variant="soft" />
          <View className="ml-3.5 flex-1">
            <Text style={{ color: colors.text }} className="text-[16px] font-bold">{t('profile.darkMode')}</Text>
            <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[13px] font-medium">
              {t('profile.darkModeDesc')}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: isDark ? '#334155' : '#CBD5E1', true: colors.primary }}
            thumbColor="#ffffff"
          />
        </Card>

        {/* Change Password */}
        <Card
          onPress={() => setShowPasswordModal(true)}
          className="mb-2.5 flex-row items-center p-4">
          <IconTile icon={KeyRound} tint="orange" size={48} iconSize={24} variant="soft" />
          <View className="ml-3.5 flex-1">
            <Text style={{ color: colors.text }} className="text-[16px] font-bold">{t('profile.changePassword')}</Text>
            <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[13px] font-medium">
              {t('profile.changePasswordDesc')}
            </Text>
          </View>
          <ChevronRight size={22} color={colors.textLight} />
        </Card>

        {/* Language Selection */}
        <Card
          onPress={() => setShowLangModal(true)}
          className="mb-5 flex-row items-center p-4">
          <IconTile icon={Globe} tint="green" size={48} iconSize={24} variant="soft" />
          <View className="ml-3.5 flex-1">
            <Text style={{ color: colors.text }} className="text-[16px] font-bold">{t('profile.language')}</Text>
            <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[13px] font-medium">
              {currentLanguageOption.label}
            </Text>
          </View>
          <ChevronRight size={22} color={colors.textLight} />
        </Card>

        {/* SECTION 2: SUPPORT & INFO */}
        <Text style={{ color: colors.textMuted }} className="mb-2 px-1 text-[13px] font-bold uppercase tracking-wider">
          {t('profile.supportSection')}
        </Text>

        {/* Support & Contact */}
        <Card
          onPress={() => setShowSupportModal(true)}
          className="mb-2.5 flex-row items-center p-4">
          <IconTile icon={HelpCircle} tint="purple" size={48} iconSize={24} variant="soft" />
          <View className="ml-3.5 flex-1">
            <Text style={{ color: colors.text }} className="text-[16px] font-bold">{t('profile.contactSupport')}</Text>
            <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[13px] font-medium">
              {t('profile.contactSupportDesc')}
            </Text>
          </View>
          <ChevronRight size={22} color={colors.textLight} />
        </Card>

        {/* Privacy & Security */}
        <Card
          onPress={() => setShowPrivacyModal(true)}
          className="mb-2.5 flex-row items-center p-4">
          <IconTile icon={ShieldCheck} tint="green" size={48} iconSize={24} variant="soft" />
          <View className="ml-3.5 flex-1">
            <Text style={{ color: colors.text }} className="text-[16px] font-bold">{t('profile.privacy')}</Text>
            <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[13px] font-medium">
              {t('profile.privacyDesc')}
            </Text>
          </View>
          <ChevronRight size={22} color={colors.textLight} />
        </Card>

        {/* App Info */}
        <Card
          onPress={() =>
            Alert.alert(
              'MediAssist Mobile',
              'Versiya: 1.0.0 (Build 2026)\nMediAssist Medical Mobile Suite.\n\nAll rights reserved.',
            )
          }
          className="mb-6 flex-row items-center p-4">
          <IconTile icon={Info} tint="blue" size={48} iconSize={24} variant="soft" />
          <View className="ml-3.5 flex-1">
            <Text style={{ color: colors.text }} className="text-[16px] font-bold">MediAssist</Text>
            <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[13px] font-medium">
              MediAssist Mobile v1.0.0
            </Text>
          </View>
          <ChevronRight size={22} color={colors.textLight} />
        </Card>

        {/* Logout Button */}
        <Button
          label={t('profile.logout')}
          icon={LogOut}
          variant="danger"
          size="lg"
          onPress={() =>
            Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('profile.logout'), style: 'destructive', onPress: logout },
            ])
          }
        />
      </KeyboardScrollView>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: CHANGE PASSWORD (DIRECT)                             */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end bg-black/50">
          <View
            style={{ backgroundColor: colors.surface, maxHeight: '88%' }}
            className="rounded-t-3xl p-6 shadow-2xl">
            <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between pb-3 border-b">
              <Text style={{ color: colors.text }} className="text-[20px] font-bold">{t('password.modalTitle')}</Text>
              <Pressable
                onPress={() => setShowPasswordModal(false)}
                hitSlop={10}
                style={{ backgroundColor: colors.field }}
                className="h-10 w-10 items-center justify-center rounded-full">
                <X size={22} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              className="mt-4">
              {/* Old password */}
              <Text style={{ color: colors.text }} className="mb-1.5 text-[14px] font-bold">{t('password.old')}</Text>
              <View
                style={{ backgroundColor: colors.field, borderColor: colors.border }}
                className="mb-3.5 flex-row items-center rounded-2xl border px-4">
                <TextInput
                  secureTextEntry={!showOldPass}
                  placeholder={t('password.oldPlaceholder')}
                  placeholderTextColor={colors.textLight}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  style={{ color: colors.text }}
                  className="flex-1 py-3.5 text-[16px]"
                />
                <Pressable onPress={() => setShowOldPass(!showOldPass)} hitSlop={8}>
                  {showOldPass ? (
                    <Eye size={20} color={colors.textMuted} />
                  ) : (
                    <EyeOff size={20} color={colors.textMuted} />
                  )}
                </Pressable>
              </View>

              {/* New password */}
              <Text style={{ color: colors.text }} className="mb-1.5 text-[14px] font-bold">{t('password.new')}</Text>
              <View
                style={{ backgroundColor: colors.field, borderColor: colors.border }}
                className="mb-3.5 flex-row items-center rounded-2xl border px-4">
                <TextInput
                  secureTextEntry={!showNewPass}
                  placeholder={t('password.newPlaceholder')}
                  placeholderTextColor={colors.textLight}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  style={{ color: colors.text }}
                  className="flex-1 py-3.5 text-[16px]"
                />
                <Pressable onPress={() => setShowNewPass(!showNewPass)} hitSlop={8}>
                  {showNewPass ? (
                    <Eye size={20} color={colors.textMuted} />
                  ) : (
                    <EyeOff size={20} color={colors.textMuted} />
                  )}
                </Pressable>
              </View>

              {/* Confirm password */}
              <Text style={{ color: colors.text }} className="mb-1.5 text-[14px] font-bold">{t('password.confirm')}</Text>
              <View
                style={{ backgroundColor: colors.field, borderColor: colors.border }}
                className="mb-5 flex-row items-center rounded-2xl border px-4">
                <TextInput
                  secureTextEntry={!showNewPass}
                  placeholder={t('password.confirmPlaceholder')}
                  placeholderTextColor={colors.textLight}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={{ color: colors.text }}
                  className="flex-1 py-3.5 text-[16px]"
                />
                <Pressable onPress={() => setShowNewPass(!showNewPass)} hitSlop={8}>
                  {showNewPass ? (
                    <Eye size={20} color={colors.textMuted} />
                  ) : (
                    <EyeOff size={20} color={colors.textMuted} />
                  )}
                </Pressable>
              </View>

              <Button
                label={passwordLoading ? t('password.updating') : t('password.submit')}
                size="lg"
                onPress={handleDirectPasswordChange}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: HELP & SUPPORT                                       */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={showSupportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSupportModal(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View style={{ backgroundColor: colors.surface }} className="rounded-t-3xl p-6 shadow-2xl">
            <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between pb-3 border-b">
              <Text style={{ color: colors.text }} className="text-[20px] font-bold">{t('support.title')}</Text>
              <Pressable
                onPress={() => setShowSupportModal(false)}
                hitSlop={10}
                style={{ backgroundColor: colors.field }}
                className="h-10 w-10 items-center justify-center rounded-full">
                <X size={22} color={colors.text} />
              </Pressable>
            </View>

            <Text style={{ color: colors.textMuted }} className="mt-3 text-[14px] leading-6">
              {t('support.desc')}
            </Text>

            <View className="mt-4 gap-2.5">
              {/* WhatsApp */}
              <Pressable
                onPress={() => Linking.openURL('https://wa.me/994704040300')}
                style={{ backgroundColor: colors.field, borderColor: colors.border }}
                className="flex-row items-center rounded-2xl border p-4 active:opacity-75">
                <View
                  style={{ backgroundColor: tints.green.bg }}
                  className="h-12 w-12 items-center justify-center rounded-xl">
                  <MessageCircle size={24} color={tints.green.fg} />
                </View>
                <View className="ml-3.5 flex-1">
                  <Text style={{ color: colors.text }} className="text-[16px] font-bold">{t('support.whatsapp')}</Text>
                  <Text style={{ color: colors.textMuted }} className="text-[13px] font-medium">+994 (70) 404-03-00</Text>
                </View>
                <ChevronRight size={20} color={colors.textLight} />
              </Pressable>

              {/* Email */}
              <Pressable
                onPress={() => Linking.openURL('mailto:support.mediassist@gmail.com')}
                style={{ backgroundColor: colors.field, borderColor: colors.border }}
                className="flex-row items-center rounded-2xl border p-4 active:opacity-75">
                <View
                  style={{ backgroundColor: tints.blue.bg }}
                  className="h-12 w-12 items-center justify-center rounded-xl">
                  <Mail size={24} color={tints.blue.fg} />
                </View>
                <View className="ml-3.5 flex-1">
                  <Text style={{ color: colors.text }} className="text-[16px] font-bold">{t('support.email')}</Text>
                  <Text style={{ color: colors.textMuted }} className="text-[13px] font-medium">support.mediassist@gmail.com</Text>
                </View>
                <ChevronRight size={20} color={colors.textLight} />
              </Pressable>

              {/* Phone */}
              <Pressable
                onPress={() => Linking.openURL('tel:+994704040300')}
                style={{ backgroundColor: colors.field, borderColor: colors.border }}
                className="flex-row items-center rounded-2xl border p-4 active:opacity-75">
                <View
                  style={{ backgroundColor: tints.purple.bg }}
                  className="h-12 w-12 items-center justify-center rounded-xl">
                  <Phone size={24} color={tints.purple.fg} />
                </View>
                <View className="ml-3.5 flex-1">
                  <Text style={{ color: colors.text }} className="text-[16px] font-bold">{t('support.hotline')}</Text>
                  <Text style={{ color: colors.textMuted }} className="text-[13px] font-medium">+994 (70) 404-03-00</Text>
                </View>
                <ChevronRight size={20} color={colors.textLight} />
              </Pressable>
            </View>

            <View className="mt-4">
              <Button label={t('common.close')} variant="soft" size="lg" onPress={() => setShowSupportModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: PRIVACY & SECURITY                                   */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={showPrivacyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPrivacyModal(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View style={{ backgroundColor: colors.surface }} className="rounded-t-3xl p-6 shadow-2xl">
            <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between pb-3 border-b">
              <Text style={{ color: colors.text }} className="text-[20px] font-bold">{t('privacy.title')}</Text>
              <Pressable
                onPress={() => setShowPrivacyModal(false)}
                hitSlop={10}
                style={{ backgroundColor: colors.field }}
                className="h-10 w-10 items-center justify-center rounded-full">
                <X size={22} color={colors.text} />
              </Pressable>
            </View>

            <View className="mt-4 gap-3.5">
              <View className="flex-row items-start">
                <ShieldCheck size={22} color={colors.primary} className="mt-0.5 mr-2.5" />
                <View className="flex-1">
                  <Text style={{ color: colors.text }} className="text-[15px] font-bold">{t('privacy.item1Title')}</Text>
                  <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[13px] leading-5">
                    {t('privacy.item1Desc')}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start">
                <Stethoscope size={22} color={tints.green.fg} className="mt-0.5 mr-2.5" />
                <View className="flex-1">
                  <Text style={{ color: colors.text }} className="text-[15px] font-bold">{t('privacy.item2Title')}</Text>
                  <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[13px] leading-5">
                    {t('privacy.item2Desc')}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start">
                <KeyRound size={22} color={tints.orange.fg} className="mt-0.5 mr-2.5" />
                <View className="flex-1">
                  <Text style={{ color: colors.text }} className="text-[15px] font-bold">{t('privacy.item3Title')}</Text>
                  <Text style={{ color: colors.textMuted }} className="mt-0.5 text-[13px] leading-5">
                    {t('privacy.item3Desc')}
                  </Text>
                </View>
              </View>
            </View>

            <View className="mt-6">
              <Button label={t('privacy.gotIt')} size="lg" onPress={() => setShowPrivacyModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: LANGUAGE SELECTOR                                    */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={showLangModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLangModal(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View style={{ backgroundColor: colors.surface }} className="rounded-t-3xl p-6 shadow-2xl">
            <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between pb-3 border-b">
              <Text style={{ color: colors.text }} className="text-[20px] font-bold">{t('language.modalTitle')}</Text>
              <Pressable
                onPress={() => setShowLangModal(false)}
                hitSlop={10}
                style={{ backgroundColor: colors.field }}
                className="h-10 w-10 items-center justify-center rounded-full">
                <X size={22} color={colors.text} />
              </Pressable>
            </View>

            <View className="mt-4 gap-2">
              {LANGUAGES.map(lang => {
                const isSelected = language === lang.code;
                return (
                  <Pressable
                    key={lang.code}
                    onPress={() => handleLanguageSelect(lang.code)}
                    style={{
                      backgroundColor: colors.field,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }}
                    className="flex-row items-center justify-between rounded-2xl border p-4 active:opacity-75">
                    <View className="flex-row items-center">
                      <Text className="text-2xl mr-3">{lang.flag}</Text>
                      <Text style={{ color: colors.text }} className="text-[16px] font-bold">{lang.label}</Text>
                    </View>
                    {isSelected && <Check size={22} color={colors.primary} strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-4">
              <Button label={t('common.close')} variant="soft" size="lg" onPress={() => setShowLangModal(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
