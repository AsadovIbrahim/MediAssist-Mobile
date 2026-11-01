/**
 * Design tokens used across the app (matches the MediAssist mockups).
 */
export const lightColors = {
  primary: '#1570EF',
  primarySoft: '#E8F1FE',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  canvas: '#F7F8FA',
  field: '#F1F3F6',
  line: '#EEF0F3',
  border: '#E2E8F0',
  input: '#F1F5F9',
  text: '#0F172A',
  textMuted: '#475467',
  textLight: '#64748B',
  danger: '#EF4444',
  dangerSoft: '#FDECEC',
  card: '#FFFFFF',
  cardShadow: '#101828',
};

export const darkColors: typeof lightColors = {
  primary: '#3B82F6',
  primarySoft: '#1E293B',
  background: '#0F172A',
  surface: '#1E293B',
  canvas: '#0F172A',
  field: '#263345',
  line: '#334155',
  border: '#334155',
  input: '#263345',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textLight: '#64748B',
  danger: '#EF4444',
  dangerSoft: '#450A0A',
  card: '#1E293B',
  cardShadow: '#000000',
};

export type ColorTokens = typeof lightColors;

export interface TintItem {
  bg: string;
  tile: string;
  fg: string;
}

export type TintName = 'blue' | 'green' | 'orange' | 'purple' | 'red';
export type TintsTokens = Record<TintName, TintItem>;

/** Tinted palettes used for icon tiles / cards. */
export const lightTints: TintsTokens = {
  blue: { bg: '#EAF2FE', tile: '#D6E6FD', fg: '#1570EF' },
  green: { bg: '#E9F8F0', tile: '#D2F1E0', fg: '#16A34A' },
  orange: { bg: '#FEF2E8', tile: '#FDE3CD', fg: '#F97316' },
  purple: { bg: '#F2EEFD', tile: '#E4DCFB', fg: '#7C3AED' },
  red: { bg: '#FDECEC', tile: '#FBD9D9', fg: '#EF4444' },
};

export const darkTints: TintsTokens = {
  blue: { bg: '#1E293B', tile: '#1E3A8A', fg: '#60A5FA' },
  green: { bg: '#1E293B', tile: '#14532D', fg: '#4ADE80' },
  orange: { bg: '#1E293B', tile: '#7C2D12', fg: '#FB923C' },
  purple: { bg: '#1E293B', tile: '#581C87', fg: '#C084FC' },
  red: { bg: '#1E293B', tile: '#7F1D1D', fg: '#F87171' },
};

/** Fallback static exports for components not yet reading useTheme() */
export const colors = lightColors;
export const tints = lightTints;
