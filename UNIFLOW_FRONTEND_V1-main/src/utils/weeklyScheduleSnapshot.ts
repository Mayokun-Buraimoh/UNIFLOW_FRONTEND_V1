import {
  DEFAULT_WEEKLY_TIME_SLOTS,
  migrateLegacyTimeSlots,
} from './weeklyScheduleTime';

/**
 * Day keys used by the weekly schedule (Mon..Sun, with `Thur` for Thursday).
 * These match the existing on-device schema in `localStorage.weeklySchedule`
 * and `localStorage.weeklyScheduleVenues`.
 */
export type WeeklyScheduleDayKey = 'Mon' | 'Tue' | 'Wed' | 'Thur' | 'Fri' | 'Sat' | 'Sun';

export const WEEKLY_SCHEDULE_DAY_KEYS: WeeklyScheduleDayKey[] = [
  'Mon',
  'Tue',
  'Wed',
  'Thur',
  'Fri',
  'Sat',
  'Sun',
];

export interface WeeklyScheduleSnapshot {
  /** Course names per day, indexed by time-slot index. Empty string = free slot. */
  grid: Record<WeeklyScheduleDayKey, string[]>;
  /** Time-slot strings like "08:00 - 10:00", aligned by index with `grid` rows. */
  timeSlots: string[];
  /** Optional venues per day, indexed the same way as `grid`. */
  venues: Record<WeeklyScheduleDayKey, string[]>;
  /** ISO timestamp the snapshot was captured (helps backend log staleness). */
  capturedAt: string;
}

const emptyDayMap = (): Record<WeeklyScheduleDayKey, string[]> => ({
  Mon: [],
  Tue: [],
  Wed: [],
  Thur: [],
  Fri: [],
  Sat: [],
  Sun: [],
});

/**
 * Read `localStorage.weeklyTimeSlots` and migrate any legacy (12-hour) entries
 * to the canonical 24-hour `"HH:MM - HH:MM"` format. Mirrors the logic in
 * `services/scheduleClassNotifications.ts` so the snapshot Ruby sees on the
 * backend matches what the local UI renders.
 */
export function readWeeklyTimeSlots(): string[] {
  try {
    const raw = localStorage.getItem('weeklyTimeSlots');
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const { slots } = migrateLegacyTimeSlots(parsed);
        return slots;
      }
    }
  } catch {
    /* noop */
  }
  return [...DEFAULT_WEEKLY_TIME_SLOTS];
}

function readDayKeyedArray(storageKey: string): Record<WeeklyScheduleDayKey, string[]> {
  const out = emptyDayMap();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const day of WEEKLY_SCHEDULE_DAY_KEYS) {
      const row = parsed?.[day];
      if (Array.isArray(row)) {
        out[day] = row.map((entry) => (typeof entry === 'string' ? entry : ''));
      }
    }
  } catch {
    /* noop */
  }
  return out;
}

/**
 * Snapshot of the user's on-device weekly schedule, suitable for shipping
 * to the backend (e.g. so Ruby can answer "how many classes do I have
 * today?", "how many are left?", etc.).
 *
 * Returns `null` only if `localStorage` itself is unavailable (e.g. SSR).
 * An empty snapshot (no classes set) is still returned with empty arrays —
 * the backend can decide how to phrase that to the user.
 */
export function readWeeklyScheduleSnapshot(): WeeklyScheduleSnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  return {
    grid: readDayKeyedArray('weeklySchedule'),
    venues: readDayKeyedArray('weeklyScheduleVenues'),
    timeSlots: readWeeklyTimeSlots(),
    capturedAt: new Date().toISOString(),
  };
}

/** True iff the snapshot has at least one non-empty class entry across the week. */
export function snapshotHasAnyClasses(snapshot: WeeklyScheduleSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  for (const day of WEEKLY_SCHEDULE_DAY_KEYS) {
    if ((snapshot.grid[day] || []).some((entry) => typeof entry === 'string' && entry.trim().length > 0)) {
      return true;
    }
  }
  return false;
}
