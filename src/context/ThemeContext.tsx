import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import {
  ColorTokens,
  darkColors,
  darkTints,
  lightColors,
  lightTints,
  TintsTokens,
} from '../theme';

export type ThemeMode = 'light' | 'dark';

export interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  colors: ColorTokens;
  tints: TintsTokens;
}

const THEME_STORAGE_KEY = 'mediassist.settings.theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const { setColorScheme } = useNativeWindColorScheme();

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'dark' || saved === 'light') {
          setThemeState(saved);
          setColorScheme(saved);
        } else {
          setColorScheme('light');
        }
      } catch {
        setColorScheme('light');
      }
    })();
  }, [setColorScheme]);

  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    setColorScheme(newTheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // ignore
    }
  };

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    await setTheme(next);
  };

  const isDark = theme === 'dark';
  const currentColors = isDark ? darkColors : lightColors;
  const currentTints = isDark ? darkTints : lightTints;

  const value = useMemo(
    () => ({
      theme,
      isDark,
      setTheme,
      toggleTheme,
      colors: currentColors,
      tints: currentTints,
    }),
    [theme, isDark, currentColors, currentTints],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'light',
      isDark: false,
      setTheme: async () => {},
      toggleTheme: async () => {},
      colors: lightColors,
      tints: lightTints,
    };
  }
  return ctx;
}

