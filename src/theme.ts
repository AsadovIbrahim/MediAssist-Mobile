/**
 * Design tokens used across the app (matches the MediAssist mockups).
 */
export const colors = {
  primary: '#1570EF',
  primarySoft: '#E8F1FE',
  background: '#F7F8FA',
  surface: '#FFFFFF',
  border: '#EEF0F3',
  input: '#F1F3F6',
  text: '#101828',
  textMuted: '#667085',
  textLight: '#98A2B3',
  danger: '#EF4444',
  dangerSoft: '#FDECEC',
};

/** Tinted palettes used for icon tiles / cards. */
export const tints = {
  blue: { bg: '#EAF2FE', tile: '#D6E6FD', fg: '#1570EF' },
  green: { bg: '#E9F8F0', tile: '#D2F1E0', fg: '#16A34A' },
  orange: { bg: '#FEF2E8', tile: '#FDE3CD', fg: '#F97316' },
  purple: { bg: '#F2EEFD', tile: '#E4DCFB', fg: '#7C3AED' },
  red: { bg: '#FDECEC', tile: '#FBD9D9', fg: '#EF4444' },
} as const;

export type TintName = keyof typeof tints;

