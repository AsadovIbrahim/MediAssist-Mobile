// Date helpers. The backend stores plain (timezone-less) DateTime values,
// so the app treats them as local "wall clock" times.

export const MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'İyun',
  'İyul',
  'Avqust',
  'Sentyabr',
  'Oktyabr',
  'Noyabr',
  'Dekabr',
];

export const MONTHS_SHORT = [
  'Yan',
  'Fev',
  'Mar',
  'Apr',
  'May',
  'İyn',
  'İyl',
  'Avq',
  'Sen',
  'Okt',
  'Noy',
  'Dek',
];

/** Monday-first week day labels. */
export const WEEKDAYS = ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Parse a backend date string. Strings without offset are treated as local time. */
export function parseDate(value: string | null | undefined): Date {
  if (!value) {
    return new Date(NaN);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value);
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  if (m && !hasZone) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] ?? 0),
      Number(m[5] ?? 0),
      Number(m[6] ?? 0),
    );
  }
  return new Date(value);
}

/** Serialize as local wall-clock time without timezone: 2026-10-12T10:00:00 */
export function toApiDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:00`;
}

/** 12 Okt 2026 */
export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? parseDate(value) : value;
  if (isNaN(d.getTime())) {
    return '';
  }
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** 12 Oktyabr 2026 */
export function formatDateLong(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 10:00 */
export function formatTime(value: string | Date): string {
  const d = typeof value === 'string' ? parseDate(value) : value;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 0:24 */
export function formatDuration(ms: number | undefined): string {
  if (!ms || ms < 0 || !isFinite(ms)) {
    return '0:00';
  }
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

/** 1.2 MB / 340 KB */
export function formatSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) {
    return '';
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

