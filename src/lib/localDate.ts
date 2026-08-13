import { format } from 'date-fns';

/** Local noon so calendar-day math is not shifted by UTC midnight. */
export function atLocalNoon(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

export function toDateKey(d: Date): string {
  return format(atLocalNoon(d), 'yyyy-MM-dd');
}

export function fromDateKey(key: string): Date {
  const [y, m, day] = key.split('-').map((n) => Number.parseInt(n, 10));
  return new Date(y || 1970, (m || 1) - 1, day || 1, 12, 0, 0, 0);
}

/** Normalize Firestore date fields (string YYYY-MM-DD or Timestamp) to a key. */
export function firestoreDateKey(value: unknown): string {
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toDateKey(value);
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return toDateKey((value as { toDate: () => Date }).toDate());
  }
  return toDateKey(new Date());
}
