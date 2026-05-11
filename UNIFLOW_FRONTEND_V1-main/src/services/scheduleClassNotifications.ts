import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import {
  DEFAULT_WEEKLY_TIME_SLOTS,
  migrateLegacyTimeSlots,
  parseTimeSlotRangeMinutes,
} from '../utils/weeklyScheduleTime';

/** Master push toggle from notification preferences (default on if unset) */
export const PUSH_MASTER_PREF_KEY = 'uniflow_push_notif_enabled';

/** Reserved numeric ids for “today’s class” local notifications (two per time slot) */
const CLASS_NOTIF_ID_BASE = 935000;
const CLASS_NOTIF_ID_MAX = 935199;

const MS_15M = 15 * 60 * 1000;

const JS_DAY_TO_SCHEDULE_KEY: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thur',
  5: 'Fri',
  6: 'Sat',
};

function readTimeSlots(): string[] {
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

function readScheduleGrid(): { schedule: Record<string, string[]>; venues: Record<string, string[]> } {
  const empty = (): Record<string, string[]> => ({
    Mon: [],
    Tue: [],
    Wed: [],
    Thur: [],
    Fri: [],
    Sat: [],
    Sun: [],
  });
  const schedule = empty();
  const venues = empty();
  try {
    const s = localStorage.getItem('weeklySchedule');
    if (s) {
      const data = JSON.parse(s) as Record<string, string[]>;
      for (const k of Object.keys(schedule)) {
        if (Array.isArray(data[k])) schedule[k] = [...data[k]];
      }
    }
    const v = localStorage.getItem('weeklyScheduleVenues');
    if (v) {
      const data = JSON.parse(v) as Record<string, string[]>;
      for (const k of Object.keys(venues)) {
        if (Array.isArray(data[k])) venues[k] = [...data[k]];
      }
    }
  } catch {
    /* noop */
  }
  return { schedule, venues };
}

async function cancelClassNotificationRange(): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending();
    const ids = pending.notifications
      .map((n) => n.id)
      .filter((id): id is number => typeof id === 'number' && id >= CLASS_NOTIF_ID_BASE && id <= CLASS_NOTIF_ID_MAX);
    if (!ids.length) return;
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    /* noop */
  }
}

function formatClockFromMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Schedules local notifications for **today** only: 15 minutes before each class slot start,
 * and at the exact start time. Uses the same weekly grid as Home / Weekly Schedule.
 */
export async function syncTodaysClassNotifications(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') {
    return;
  }

  if (localStorage.getItem(PUSH_MASTER_PREF_KEY) === 'false') {
    await cancelClassNotificationRange();
    return;
  }

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') {
        return;
      }
    }
  } catch {
    return;
  }

  await cancelClassNotificationRange();

  const { schedule, venues } = readScheduleGrid();
  const timeSlots = readTimeSlots();
  const todayKey = JS_DAY_TO_SCHEDULE_KEY[new Date().getDay()];
  const row = schedule[todayKey] || [];
  const venueRow = venues[todayKey] || [];

  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  const d = now.getDate();

  const notifications: {
    id: number;
    title: string;
    body: string;
    schedule: { at: Date };
    actionTypeId: string;
    extra: Record<string, string>;
  }[] = [];

  const maxSlots = Math.max(timeSlots.length, row.length, 6);

  for (let timeIndex = 0; timeIndex < maxSlots; timeIndex++) {
    const course = (row[timeIndex] || '').trim();
    if (!course) continue;

    const slot = timeSlots[timeIndex] || DEFAULT_WEEKLY_TIME_SLOTS[timeIndex] || '09:00 - 10:00';
    const { start: startMinutes } = parseTimeSlotRangeMinutes(slot);
    const venue = (venueRow[timeIndex] || '').trim();
    const locationLine = venue ? `Location: ${venue}` : 'Location: not set';
    const startLabel = formatClockFromMinutes(startMinutes);

    const hh = Math.floor(startMinutes / 60);
    const mm = startMinutes % 60;
    const commencement = new Date(y, mo, d, hh, mm, 0, 0);
    const fifteenBefore = new Date(commencement.getTime() - MS_15M);

    const id15 = CLASS_NOTIF_ID_BASE + timeIndex * 10;
    const idStart = CLASS_NOTIF_ID_BASE + timeIndex * 10 + 1;

    if (fifteenBefore.getTime() > Date.now()) {
      notifications.push({
        id: id15,
        title: 'Class starting soon',
        body: `${course} begins at ${startLabel}. ${locationLine}`,
        schedule: { at: fifteenBefore },
        actionTypeId: '',
        extra: { type: 'CLASS_REMINDER_15', day: todayKey, timeIndex: String(timeIndex) },
      });
    }

    if (commencement.getTime() > Date.now()) {
      notifications.push({
        id: idStart,
        title: `Time for class: ${course}`,
        body: `Your class starts now (${startLabel}). ${locationLine}`,
        schedule: { at: commencement },
        actionTypeId: '',
        extra: { type: 'CLASS_START', day: todayKey, timeIndex: String(timeIndex) },
      });
    }
  }

  if (!notifications.length) return;

  try {
    await LocalNotifications.schedule({ notifications });
  } catch (e) {
    console.warn('[notifications] class schedule sync failed', e);
  }
}

let classNotifDebounce: ReturnType<typeof setTimeout> | null = null;

export function requestTodaysClassNotificationsSync(): void {
  if (classNotifDebounce) clearTimeout(classNotifDebounce);
  classNotifDebounce = setTimeout(() => {
    classNotifDebounce = null;
    void syncTodaysClassNotifications();
  }, 1200);
}
