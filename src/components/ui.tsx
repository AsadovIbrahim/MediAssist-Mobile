import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Eye, EyeOff, Plus, Search, type LucideIcon } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { colors, tints, type TintName } from '../theme';

/* ------------------------------------------------------------------ */
/* Keyboard handling (works with Android edge-to-edge & iOS)           */
/* ------------------------------------------------------------------ */

export function useKeyboard() {
  const [height, setHeight] = useState(0);
  const [topY, setTopY] = useState(() => Dimensions.get('window').height);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, e => {
      const winH = Dimensions.get('window').height;
      const kbH = e.endCoordinates.height;
      setHeight(kbH);
      setTopY(e.endCoordinates.screenY || winH - kbH);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
      setTopY(Dimensions.get('window').height);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  return { keyboardHeight: height, keyboardTopY: topY };
}

type ViewNode = React.ComponentRef<typeof View>;
type ScrollNode = React.ComponentRef<typeof ScrollView>;

const ScrollEnsureContext = createContext<((target: ViewNode | null) => void) | null>(null);

/**
 * Drop-in ScrollView for forms that shrinks above the keyboard and
 * automatically scrolls any focused input into view.
 */
export function KeyboardScrollView({
  children,
  contentContainerStyle,
  ...rest
}: ScrollViewProps) {
  const insets = useSafeAreaInsets();
  const { keyboardHeight, keyboardTopY } = useKeyboard();
  const scrollRef = useRef<ScrollNode>(null);
  const scrollYRef = useRef(0);
  const focusedRef = useRef<ViewNode | null>(null);

  const ensureVisible = useCallback(
    (target: ViewNode | null, kbTop = keyboardTopY) => {
      if (!target) {
        return;
      }
      target.measureInWindow((_x: number, y: number, _w: number, h: number) => {
        if (!h && !y) {
          return;
        }
        const navOffset = Platform.OS === 'android' ? insets.bottom : 0;
        const limit = kbTop - navOffset - 28;
        const bottom = y + Math.min(h, 160);
        if (bottom > limit) {
          const delta = bottom - limit;
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollYRef.current + delta),
            animated: true,
          });
        }
      });
    },
    [keyboardTopY, insets.bottom],
  );

  // When the keyboard opens, scroll the currently focused field above it.
  useEffect(() => {
    if (keyboardHeight > 0 && focusedRef.current) {
      const t = setTimeout(() => ensureVisible(focusedRef.current, keyboardTopY), 60);
      return () => clearTimeout(t);
    }
  }, [keyboardHeight, keyboardTopY, ensureVisible]);

  const registerFocus = useCallback(
    (node: ViewNode | null) => {
      focusedRef.current = node;
      if (keyboardHeight > 0 && node) {
        setTimeout(() => ensureVisible(node, keyboardTopY), 60);
      }
    },
    [keyboardHeight, keyboardTopY, ensureVisible],
  );

  const extraBottom =
    keyboardHeight > 0
      ? Platform.OS === 'android'
        ? keyboardHeight + insets.bottom + 36
        : Math.max(24, keyboardHeight - insets.bottom + 24)
      : 32;

  return (
    <ScrollEnsureContext.Provider value={registerFocus}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={e => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={[
          { paddingBottom: extraBottom },
          contentContainerStyle,
        ]}
        {...rest}>
        {children}
      </ScrollView>
    </ScrollEnsureContext.Provider>
  );
}

/**
 * Container for screens with a fixed bottom input bar (e.g. AI chat)
 * so the bottom bar lifts up above the keyboard.
 */
export function KeyboardLiftView({
  children,
  className = '',
  fullBottom = false,
}: {
  children: React.ReactNode;
  className?: string;
  fullBottom?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { keyboardHeight } = useKeyboard();
  const bottomOffset =
    keyboardHeight > 0
      ? Platform.OS === 'android'
        ? fullBottom
          ? keyboardHeight + insets.bottom
          : keyboardHeight
        : fullBottom
        ? keyboardHeight
        : Math.max(0, keyboardHeight - insets.bottom)
      : 0;

  return (
    <View style={{ paddingBottom: bottomOffset }} className={`flex-1 ${className}`}>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

interface HeaderProps {
  title: string;
  /** Right side action, e.g. "+ Əlavə et" or "Saxla" */
  right?: React.ReactNode;
  back?: boolean;
}

export function ScreenHeader({ title, right, back = true }: HeaderProps) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center px-4 pt-3 pb-3">
      {back && (
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={14}
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="mr-3 h-11 w-11 items-center justify-center rounded-2xl border active:opacity-70 shadow-sm">
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
      )}
      <Text style={{ color: colors.text }} className="flex-1 text-[21px] font-bold" numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

interface ButtonProps {
  label: string;
  onPress?: () => void;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'soft' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Button({
  label,
  onPress,
  icon: Icon,
  loading,
  disabled,
  variant = 'primary',
  size = 'md',
  className = '',
}: ButtonProps) {
  const { colors, isDark } = useTheme();
  const palette = {
    primary: { bg: colors.primary, fg: '#fff' },
    soft: { bg: isDark ? '#1E3A8A' : colors.primarySoft, fg: isDark ? '#93C5FD' : colors.primary },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    ghost: { bg: 'transparent', fg: colors.primary },
  }[variant];
  const pad = { sm: 'px-4 py-2.5', md: 'px-5 py-3.5', lg: 'px-6 py-4' }[size];
  const text = { sm: 'text-[15px]', md: 'text-[16px]', lg: 'text-[18px]' }[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{ backgroundColor: palette.bg, opacity: disabled ? 0.5 : 1 }}
      className={`flex-row items-center justify-center rounded-2xl active:opacity-80 ${pad} ${className}`}>
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <>
          {Icon && (
            <Icon
              size={size === 'lg' ? 22 : size === 'md' ? 20 : 18}
              color={palette.fg}
              strokeWidth={2.4}
            />
          )}
          <Text
            style={{ color: palette.fg }}
            className={`font-bold ${text} ${Icon ? 'ml-2' : ''}`}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function AddButton({ onPress, label }: { onPress: () => void; label?: string }) {
  const { t } = useLanguage();
  return <Button label={label ?? t('common.add')} icon={Plus} onPress={onPress} size="sm" />;
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export function SearchBar(props: TextInputProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{ backgroundColor: colors.field, borderColor: colors.border }}
      className="mx-4 mb-3 flex-row items-center rounded-2xl border px-3.5 py-1">
      <Search size={22} color={colors.textMuted} />
      <TextInput
        placeholderTextColor={colors.textLight}
        returnKeyType="search"
        style={{ color: colors.text }}
        className="ml-2.5 flex-1 py-3 text-[16px] font-medium"
        {...props}
      />
    </View>
  );
}

interface FieldProps extends TextInputProps {
  label?: string;
  error?: string;
  counter?: number;
}

export function Field({
  label,
  error,
  counter,
  multiline,
  value,
  onFocus,
  secureTextEntry,
  ...rest
}: FieldProps) {
  const { colors } = useTheme();
  const wrapRef = useRef<ViewNode>(null);
  const ensureVisible = useContext(ScrollEnsureContext);
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <View ref={wrapRef} collapsable={false} className="mb-5">
      {label && (
        <Text style={{ color: colors.text }} className="mb-2 text-[16px] font-bold">
          {label}
        </Text>
      )}
      {secureTextEntry ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          }}
          className="flex-row items-center rounded-2xl border px-4">
          <TextInput
            value={value}
            secureTextEntry={!passwordVisible}
            placeholderTextColor={colors.textLight}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ color: colors.text }}
            className="flex-1 py-3.5 text-[16px]"
            maxLength={counter}
            onFocus={e => {
              ensureVisible?.(wrapRef.current);
              onFocus?.(e);
            }}
            {...rest}
          />
          <Pressable
            onPress={() => setPasswordVisible(prev => !prev)}
            hitSlop={12}
            className="ml-2 py-1 pl-1">
            {passwordVisible ? (
              <Eye size={22} color={colors.textMuted} />
            ) : (
              <EyeOff size={22} color={colors.textMuted} />
            )}
          </Pressable>
        </View>
      ) : (
        <TextInput
          value={value}
          multiline={multiline}
          placeholderTextColor={colors.textLight}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[
            multiline ? { minHeight: 130 } : undefined,
            {
              backgroundColor: colors.surface,
              borderColor: error ? colors.danger : colors.border,
              color: colors.text,
            },
          ]}
          className="rounded-2xl border px-4 py-3.5 text-[16px] leading-6"
          maxLength={counter}
          onFocus={e => {
            ensureVisible?.(wrapRef.current);
            onFocus?.(e);
          }}
          {...rest}
        />
      )}
      {counter !== undefined && (
        <Text style={{ color: colors.textMuted }} className="mt-1 self-end text-xs font-semibold">
          {value?.length ?? 0}/{counter}
        </Text>
      )}
      {error && <Text className="mt-1.5 text-sm font-semibold text-danger">{error}</Text>}
    </View>
  );
}

export function extractAzerbaijanDigits(raw: string): string {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('994')) {
    d = d.slice(3);
  }
  if (d.startsWith('0')) {
    d = d.slice(1);
  }
  return d.slice(0, 9);
}

export function formatAzerbaijanDisplay(digitsOrRaw: string): string {
  const d = extractAzerbaijanDigits(digitsOrRaw);
  let res = '';
  if (d.length > 0) {
    res = `(${d.slice(0, Math.min(2, d.length))}`;
    if (d.length >= 2) res += ') ';
  }
  if (d.length > 2) {
    res += d.slice(2, Math.min(5, d.length));
  }
  if (d.length >= 5) {
    res += `-${d.slice(5, Math.min(7, d.length))}`;
  }
  if (d.length >= 7) {
    res += `-${d.slice(7, 9)}`;
  }
  return res;
}

export interface PhoneFieldProps {
  label?: string;
  value: string;
  onChangeText: (normalizedPhone: string) => void;
  error?: string;
  placeholder?: string;
}

export function PhoneField({
  label = 'Telefon *',
  value,
  onChangeText,
  error,
  placeholder = '(50) 000-00-00',
}: PhoneFieldProps) {
  const { colors } = useTheme();
  const wrapRef = useRef<ViewNode>(null);
  const ensureVisible = useContext(ScrollEnsureContext);

  const display = formatAzerbaijanDisplay(value);

  const handleChange = (text: string) => {
    let d = text.replace(/\D/g, '');
    if (d.startsWith('994')) d = d.slice(3);
    if (d.startsWith('0')) d = d.slice(1);

    const prevD = extractAzerbaijanDigits(value);
    if (text.length < display.length && d === prevD && d.length > 0) {
      d = d.slice(0, -1);
    }

    d = d.slice(0, 9);
    onChangeText(d ? `+994${d}` : '');
  };

  return (
    <View ref={wrapRef} collapsable={false} className="mb-5">
      {label && (
        <Text style={{ color: colors.text }} className="mb-2 text-[16px] font-bold">
          {label}
        </Text>
      )}
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: error ? colors.danger : colors.border,
        }}
        className="flex-row items-center rounded-2xl border px-3.5 py-1">
        <View
          className="flex-row items-center pr-3 border-r"
          style={{ borderColor: colors.border }}>
          <Text className="mr-1.5 text-[18px]">🇦🇿</Text>
          <Text style={{ color: colors.text }} className="text-[16px] font-bold">
            +994
          </Text>
        </View>

        <TextInput
          value={display}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          keyboardType="phone-pad"
          style={{ color: colors.text }}
          className="flex-1 py-3 pl-3 text-[16px] font-medium"
          maxLength={15}
          onFocus={e => {
            ensureVisible?.(wrapRef.current);
          }}
        />
      </View>
      {error && <Text className="mt-1.5 text-sm font-semibold text-danger">{error}</Text>}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Filter chips & segmented control                                    */
/* ------------------------------------------------------------------ */

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      className="mb-3 grow-0"
      contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            hitSlop={6}
            style={
              active
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.field, borderColor: colors.border }
            }
            className={`rounded-2xl px-5 py-2.5 ${active ? '' : 'border'}`}>
            <Text
              style={active ? { color: '#ffffff' } : { color: colors.text }}
              className={`text-[15px] ${active ? 'font-bold' : 'font-semibold'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View className="mb-5 flex-row gap-2.5">
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            hitSlop={6}
            style={
              active
                ? {
                    backgroundColor: isDark ? '#1E3A8A' : colors.primarySoft,
                    borderColor: colors.primary,
                  }
                : { backgroundColor: colors.field, borderColor: colors.border }
            }
            className="flex-1 items-center rounded-2xl py-3 border">
            <Text
              style={{ color: active ? colors.primary : colors.textMuted }}
              className={`text-[15px] ${active ? 'font-bold' : 'font-semibold'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function IconTile({
  icon: Icon,
  tint,
  size = 48,
  iconSize,
  variant = 'tile',
}: {
  icon: LucideIcon;
  tint: TintName;
  size?: number;
  iconSize?: number;
  /** "tile" = darker tinted square (home cards), "soft" = light tinted square (lists) */
  variant?: 'tile' | 'soft';
}) {
  const { tints } = useTheme();
  const t = tints[tint];
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: variant === 'tile' ? t.tile : t.bg,
        borderRadius: size * 0.28,
      }}
      className="items-center justify-center">
      <Icon size={iconSize ?? size * 0.5} color={t.fg} strokeWidth={2} />
    </View>
  );
}

export function Card({
  children,
  onPress,
  onLongPress,
  className = '',
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: isDark ? '#000000' : '#101828',
          shadowOpacity: isDark ? 0.35 : 0.05,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        },
        style,
      ]}
      className={`rounded-2xl border active:opacity-90 ${className}`}>
      {children}
    </Pressable>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View className="flex-1 items-center justify-center py-16">
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View className="items-center px-8 py-16">
      <View
        style={{ backgroundColor: colors.field }}
        className="mb-4 h-20 w-20 items-center justify-center rounded-3xl">
        <Icon size={36} color={colors.textMuted} />
      </View>
      <Text style={{ color: colors.text }} className="text-center text-lg font-bold">
        {title}
      </Text>
      {text && (
        <Text
          style={{ color: colors.textMuted }}
          className="mt-2 text-center text-[15px] font-medium leading-6">
          {text}
        </Text>
      )}
      {action && <View className="mt-6">{action}</View>}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLanguage();
  return (
    <View className="mx-4 mb-3 rounded-2xl bg-danger-soft p-4">
      <Text className="text-[15px] font-semibold text-danger">{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} className="mt-2.5 self-start">
          <Text className="text-[15px] font-bold text-danger">{t('common.retry')}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function CountBadge({ count, tint }: { count: number; tint: TintName }) {
  const { tints } = useTheme();
  const t = tints[tint];
  return (
    <View style={{ backgroundColor: t.tile }} className="min-w-[28px] items-center rounded-xl px-2.5 py-1">
      <Text style={{ color: t.fg }} className="text-[13px] font-bold">
        {count}
      </Text>
    </View>
  );
}
