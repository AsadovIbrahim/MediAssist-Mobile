import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import appLogo from '../assets/logo.png';
import { authApi } from '../api/services';
import { Button, Field, KeyboardScrollView } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import type { RootScreenProps } from '../navigation/types';
import { colors } from '../theme';

type TextInputNode = React.ComponentRef<typeof TextInput>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 60;

export function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Diqqət', 'E-poçt və şifrəni daxil edin.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      const msg = (e as Error).message || '';
      if (msg.startsWith('OTP_REQUIRED|')) {
        const [, pendingEmail, pendingPhone] = msg.split('|');
        navigation.navigate('OtpVerification', {
          email: pendingEmail || email.trim(),
          phone: pendingPhone || '',
        });
        return;
      }
      Alert.alert('Giriş xətası', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className="px-6 py-8">
        <View className="mb-8 items-center">
          <Image
            source={appLogo}
            style={{ width: 76, height: 76, borderRadius: 18 }}
            resizeMode="contain"
            className="mb-4"
          />
          <Text className="text-2xl font-bold text-ink">MediAssist</Text>
          <Text className="mt-1 text-center text-sm text-ink-muted">
            Şəxsi tibbi sənəd və müayinələrin idarə edilməsi
          </Text>
        </View>

        <View className="rounded-2xl border border-line bg-surface p-5">
          <Field
            label="E-poçt"
            placeholder="E-poçt ünvanınızı daxil edin"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label="Şifrə"
            placeholder="Şifrənizi daxil edin"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <View
            style={{ flexDirection: 'row', justifyContent: 'flex-end' }}
            className="-mt-1 mb-4">
            <Pressable
              onPress={() =>
                navigation.navigate('ForgotPassword', {
                  initialEmail: email.trim(),
                })
              }
              hitSlop={8}>
              <Text className="text-right text-xs font-semibold text-primary">
                Şifrəni unutmusunuz?
              </Text>
            </Pressable>
          </View>

          <Button label="Daxil ol" size="lg" loading={loading} onPress={onSubmit} />
        </View>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-sm text-ink-muted">Hesabınız yoxdur? </Text>
          <Pressable onPress={() => navigation.navigate('Register')}>
            <Text className="text-sm font-semibold text-primary">Qeydiyyatdan keçin</Text>
          </Pressable>
        </View>
      </KeyboardScrollView>
    </SafeAreaView>
  );
}

export function RegisterScreen({ navigation }: RootScreenProps<'Register'>) {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [workplace, setWorkplace] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert('Diqqət', 'Zəhmət olmasa bütün məcburi xanaları doldurun.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Diqqət', 'Şifrə ən azı 6 simvoldan ibarət olmalıdır.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Diqqət', 'Daxil edilən şifrələr bir-biri ilə eyni deyil.');
      return;
    }
    setLoading(true);
    try {
      const res = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        specialty: specialty.trim() || null,
        workplace: workplace.trim() || null,
        password,
      });

      navigation.navigate('OtpVerification', {
        email: res.email || email.trim(),
        phone: res.phone || phone.trim(),
        expiresInSeconds: res.expiresInSeconds,
      });
    } catch (e) {
      Alert.alert('Qeydiyyat xətası', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardScrollView className="px-6 py-6">
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          className="mb-4 h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface">
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>

        <Text className="text-2xl font-bold text-ink">Həkim qeydiyyatı</Text>
        <Text className="mt-1 mb-6 text-sm text-ink-muted">
          Yeni hesab yaradaraq pasiyentlərinizi idarə edin
        </Text>

        <View className="rounded-2xl border border-line bg-surface p-5">
          <Field
            label="Ad *"
            placeholder="Adınızı daxil edin"
            value={firstName}
            onChangeText={setFirstName}
          />
          <Field
            label="Soyad *"
            placeholder="Soyadınızı daxil edin"
            value={lastName}
            onChangeText={setLastName}
          />
          <Field
            label="E-poçt *"
            placeholder="E-poçt ünvanınızı daxil edin"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label="Telefon *"
            placeholder="+994 XX XXX XX XX"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <Field
            label="İxtisas"
            placeholder="İxtisasınızı qeyd edin"
            value={specialty}
            onChangeText={setSpecialty}
          />
          <Field
            label="İş yeri"
            placeholder="Çalışdığınız müəssisəni qeyd edin"
            value={workplace}
            onChangeText={setWorkplace}
          />
          <Field
            label="Şifrə *"
            placeholder="Şifrə təyin edin (min. 6 simvol)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Field
            label="Şifrənin təkrarı *"
            placeholder="Şifrəni təkrar daxil edin"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <Button label="Qeydiyyatdan keç" size="lg" loading={loading} onPress={onSubmit} />
        </View>

        <View className="mt-5 mb-8 flex-row justify-center">
          <Text className="text-sm text-ink-muted">Artıq hesabınız var? </Text>
          <Pressable onPress={() => navigation.goBack()}>
            <Text className="text-sm font-semibold text-primary">Daxil olun</Text>
          </Pressable>
        </View>
      </KeyboardScrollView>
    </SafeAreaView>
  );
}

export function OtpVerificationScreen({
  navigation,
  route,
}: RootScreenProps<'OtpVerification'>) {
  const { email } = route.params;
  const { verifyOtp, resendOtp } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SEC);

  const inputRefs = useRef<Array<TextInputNode | null>>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const submitCode = async (codeToVerify: string) => {
    const clean = codeToVerify.replace(/\D/g, '');
    if (clean.length !== OTP_LENGTH) {
      Alert.alert('Diqqət', 'Zəhmət olmasa 6 rəqəmli təsdiq kodunu tam daxil edin.');
      return;
    }

    setSubmitting(true);
    try {
      await verifyOtp(email, clean);
    } catch (e) {
      Alert.alert('Təsdiqləmə xətası', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const onlyDigits = rawValue.replace(/\D/g, '');

    if (onlyDigits.length > 1) {
      const nextDigits = [...digits];
      for (let i = 0; i < OTP_LENGTH; i += 1) {
        if (index + i < OTP_LENGTH && onlyDigits[i]) {
          nextDigits[index + i] = onlyDigits[i];
        }
      }
      setDigits(nextDigits);
      const nextFocusIndex = Math.min(index + onlyDigits.length, OTP_LENGTH - 1);
      inputRefs.current[nextFocusIndex]?.focus();

      const combined = nextDigits.join('');
      if (combined.length === OTP_LENGTH) {
        submitCode(combined);
      }
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = onlyDigits;
    setDigits(nextDigits);

    if (onlyDigits && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const combined = nextDigits.join('');
    if (onlyDigits && index === OTP_LENGTH - 1 && combined.length === OTP_LENGTH) {
      submitCode(combined);
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const nextDigits = [...digits];
      nextDigits[index - 1] = '';
      setDigits(nextDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || resending) {
      return;
    }
    setResending(true);
    try {
      await resendOtp(email);
      setDigits(Array(OTP_LENGTH).fill(''));
      setSecondsLeft(RESEND_COOLDOWN_SEC);
      inputRefs.current[0]?.focus();
      Alert.alert('Göndərildi', 'Yeni 6 rəqəmli təsdiq kodu e-poçt ünvanınıza göndərildi.');
    } catch (e) {
      Alert.alert('Xəta', (e as Error).message);
    } finally {
      setResending(false);
    }
  };

  const formattedTimer = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(
    secondsLeft % 60,
  ).padStart(2, '0')}`;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className="px-6 py-6">
        <Pressable
          onPress={() => navigation.goBack()}
          className="mb-6 h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface">
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>

        <View className="mb-6 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
            <ShieldCheck size={34} color={colors.primary} />
          </View>
          <Text className="text-2xl font-bold text-ink">OTP Təsdiqləmə</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-ink-muted">
            Qeydiyyatı tamamlamaq üçün{' '}
            <Text className="font-semibold text-ink">{email}</Text> e-poçt ünvanına
            göndərilən 6 rəqəmli kodu daxil edin
          </Text>
        </View>

        <View className="rounded-2xl border border-line bg-surface p-5">
          <View className="mb-6 flex-row justify-between gap-2">
            {digits.map((digit, index) => {
              const isFilled = Boolean(digit);
              return (
                <TextInput
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  value={digit}
                  onChangeText={(val) => handleDigitChange(index, val)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={index === 0 ? OTP_LENGTH : 1}
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  selectTextOnFocus
                  className={`h-13 flex-1 rounded-xl border text-center text-xl font-bold text-ink ${
                    isFilled
                      ? 'border-primary bg-primary-soft/40'
                      : 'border-line bg-canvas'
                  }`}
                />
              );
            })}
          </View>

          <Button
            label="Təsdiqlə və daxil ol"
            size="lg"
            loading={submitting}
            disabled={digits.join('').length !== OTP_LENGTH}
            onPress={() => submitCode(digits.join(''))}
          />

          <View className="mt-5 items-center">
            {secondsLeft > 0 ? (
              <Text className="text-xs text-ink-muted">
                Yeni kod göndərmək üçün gözləyin:{' '}
                <Text className="font-semibold text-ink">{formattedTimer}</Text>
              </Text>
            ) : (
              <Pressable
                onPress={handleResend}
                disabled={resending}
                className="flex-row items-center gap-1.5 py-1">
                <RefreshCw size={14} color={colors.primary} />
                <Text className="text-sm font-semibold text-primary">
                  {resending ? 'Göndərilir...' : 'Kodu yenidən göndər'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardScrollView>
    </SafeAreaView>
  );
}

export function ForgotPasswordScreen({
  navigation,
  route,
}: RootScreenProps<'ForgotPassword'>) {
  const [email, setEmail] = useState(route.params?.initialEmail ?? '');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      Alert.alert('Diqqət', 'Zəhmət olmasa e-poçt ünvanınızı daxil edin.');
      return;
    }

    setLoading(true);
    try {
      await authApi.forgotPassword(cleanEmail);
      navigation.navigate('ResetPasswordOtp', { email: cleanEmail });
    } catch (e) {
      Alert.alert('Xəta', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className="px-6 py-6">
        <Pressable
          onPress={() => navigation.goBack()}
          className="mb-6 h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface">
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>

        <View className="mb-6 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
            <KeyRound size={34} color={colors.primary} />
          </View>
          <Text className="text-2xl font-bold text-ink">Şifrəni unutmusunuz?</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-ink-muted">
            Qeydiyyatdan keçdiyiniz e-poçt ünvanını daxil edin. Şifrəni yeniləmək üçün
            e-poçtunuza 6 rəqəmli təsdiq kodu göndəriləcək.
          </Text>
        </View>

        <View className="rounded-2xl border border-line bg-surface p-5">
          <Field
            label="E-poçt"
            placeholder="E-poçt ünvanınızı daxil edin"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <Button
            label="Təsdiq kodu göndər"
            size="lg"
            loading={loading}
            onPress={onSubmit}
          />
        </View>
      </KeyboardScrollView>
    </SafeAreaView>
  );
}

export function ResetPasswordOtpScreen({
  navigation,
  route,
}: RootScreenProps<'ResetPasswordOtp'>) {
  const { email } = route.params;

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SEC);

  const inputRefs = useRef<Array<TextInputNode | null>>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const submitCode = async (codeToVerify: string) => {
    const clean = codeToVerify.replace(/\D/g, '');
    if (clean.length !== OTP_LENGTH) {
      Alert.alert('Diqqət', 'Zəhmət olmasa 6 rəqəmli təsdiq kodunu tam daxil edin.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.verifyResetOtp(email, clean);
      navigation.replace('ResetPasswordNew', {
        email,
        otpCode: clean,
      });
    } catch (e) {
      Alert.alert('Təsdiqləmə xətası', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const onlyDigits = rawValue.replace(/\D/g, '');

    if (onlyDigits.length > 1) {
      const nextDigits = [...digits];
      for (let i = 0; i < OTP_LENGTH; i += 1) {
        if (index + i < OTP_LENGTH && onlyDigits[i]) {
          nextDigits[index + i] = onlyDigits[i];
        }
      }
      setDigits(nextDigits);
      const nextFocusIndex = Math.min(index + onlyDigits.length, OTP_LENGTH - 1);
      inputRefs.current[nextFocusIndex]?.focus();

      const combined = nextDigits.join('');
      if (combined.length === OTP_LENGTH) {
        submitCode(combined);
      }
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = onlyDigits;
    setDigits(nextDigits);

    if (onlyDigits && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const combined = nextDigits.join('');
    if (onlyDigits && index === OTP_LENGTH - 1 && combined.length === OTP_LENGTH) {
      submitCode(combined);
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const nextDigits = [...digits];
      nextDigits[index - 1] = '';
      setDigits(nextDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || resending) {
      return;
    }
    setResending(true);
    try {
      await authApi.forgotPassword(email);
      setDigits(Array(OTP_LENGTH).fill(''));
      setSecondsLeft(RESEND_COOLDOWN_SEC);
      inputRefs.current[0]?.focus();
      Alert.alert('Göndərildi', 'Yeni 6 rəqəmli təsdiq kodu e-poçt ünvanınıza göndərildi.');
    } catch (e) {
      Alert.alert('Xəta', (e as Error).message);
    } finally {
      setResending(false);
    }
  };

  const formattedTimer = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(
    secondsLeft % 60,
  ).padStart(2, '0')}`;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className="px-6 py-6">
        <Pressable
          onPress={() => navigation.goBack()}
          className="mb-6 h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface">
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>

        <View className="mb-6 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
            <ShieldCheck size={34} color={colors.primary} />
          </View>
          <Text className="text-2xl font-bold text-ink">Kodun təsdiqlənməsi</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-ink-muted">
            Şifrəni yeniləmək üçün{' '}
            <Text className="font-semibold text-ink">{email}</Text> e-poçt ünvanına
            göndərilən 6 rəqəmli kodu daxil edin
          </Text>
        </View>

        <View className="rounded-2xl border border-line bg-surface p-5">
          <View className="mb-6 flex-row justify-between gap-2">
            {digits.map((digit, index) => {
              const isFilled = Boolean(digit);
              return (
                <TextInput
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  value={digit}
                  onChangeText={(val) => handleDigitChange(index, val)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={index === 0 ? OTP_LENGTH : 1}
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  selectTextOnFocus
                  className={`h-13 flex-1 rounded-xl border text-center text-xl font-bold text-ink ${
                    isFilled
                      ? 'border-primary bg-primary-soft/40'
                      : 'border-line bg-canvas'
                  }`}
                />
              );
            })}
          </View>

          <Button
            label="Kodu təsdiqlə"
            size="lg"
            loading={submitting}
            disabled={digits.join('').length !== OTP_LENGTH}
            onPress={() => submitCode(digits.join(''))}
          />

          <View className="mt-5 items-center">
            {secondsLeft > 0 ? (
              <Text className="text-xs text-ink-muted">
                Yeni kod göndərmək üçün gözləyin:{' '}
                <Text className="font-semibold text-ink">{formattedTimer}</Text>
              </Text>
            ) : (
              <Pressable
                onPress={handleResend}
                disabled={resending}
                className="flex-row items-center gap-1.5 py-1">
                <RefreshCw size={14} color={colors.primary} />
                <Text className="text-sm font-semibold text-primary">
                  {resending ? 'Göndərilir...' : 'Kodu yenidən göndər'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardScrollView>
    </SafeAreaView>
  );
}

export function ResetPasswordNewScreen({
  navigation,
  route,
}: RootScreenProps<'ResetPasswordNew'>) {
  const { email, otpCode } = route.params;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Diqqət', 'Yeni şifrə ən azı 6 simvoldan ibarət olmalıdır.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Diqqət', 'Daxil edilən şifrələr bir-biri ilə eyni deyil.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(email, otpCode, newPassword);
      Alert.alert(
        'Uğurlu',
        'Şifrəniz uğurla yeniləndi. Yeni şifrənizlə daxil ola bilərsiniz.',
        [
          {
            text: 'Daxil ol',
            onPress: () => navigation.popToTop(),
          },
        ],
      );
    } catch (e) {
      Alert.alert('Xəta', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className="px-6 py-6">
        <Pressable
          onPress={() => navigation.goBack()}
          className="mb-6 h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface">
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>

        <View className="mb-6 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
            <LockKeyhole size={34} color={colors.primary} />
          </View>
          <Text className="text-2xl font-bold text-ink">Yeni şifrə təyin edin</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-ink-muted">
            <Text className="font-semibold text-ink">{email}</Text> hesabı üçün yeni
            şifrənizi daxil edin
          </Text>
        </View>

        <View className="rounded-2xl border border-line bg-surface p-5">
          <Field
            label="Yeni şifrə *"
            placeholder="Minimum 6 simvol"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <Field
            label="Yeni şifrənin təkrarı *"
            placeholder="Şifrəni təkrar daxil edin"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <Button
            label="Şifrəni yenilə"
            size="lg"
            loading={loading}
            onPress={onSubmit}
          />
        </View>
      </KeyboardScrollView>
    </SafeAreaView>
  );
}
