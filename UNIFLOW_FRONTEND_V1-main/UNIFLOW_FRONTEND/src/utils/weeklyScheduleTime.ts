/**
 * Weekly timetable uses 24-hour ranges: "HH:MM - HH:MM"
 */

export const DEFAULT_WEEKLY_TIME_SLOTS = [
  '17:00 - 19:00',
  '15:00 - 17:00',
  '14:00 - 15:00',
  '12:00 - 14:00',
  '10:00 - 12:00',
  '08:00 - 10:00',
];

export const QUICK_TIME_PRESETS_24 = [
  '08:00 - 10:00',
  '10:00 - 12:00',
  '12:00 - 14:00',
  '14:00 - 16:00',
  '16:00 - 18:00',
  '18:00 - 20:00',
];

const LEGACY_SLOT_MAP: Record<string, string> = {
  '5:00 - 7:00': '17:00 - 19:00',
  '3:00 - 5:00': '15:00 - 17:00',
  '2:00 - 3:00': '14:00 - 15:00',
  '12:00 - 2:00': '12:00 - 14:00',
  '10:00 - 12:00': '10:00 - 12:00',
  '8:00 - 10:00': '08:00 - 10:00',
  '2:00 - 4:00': '14:00 - 16:00',
  '4:00 - 6:00': '16:00 - 18:00',
  '6:00 - 8:00': '18:00 - 20:00',
};

export function migrateLegacyTimeSlots(slots: string[]): { slots: string[]; changed: boolean } {
  let changed = false;
  const next = slots.map((s) => {
    const trimmed = String(s).trim();
    if (LEGACY_SLOT_MAP[trimmed]) {
      changed = true;
      return LEGACY_SLOT_MAP[trimmed];
    }
    return s;
  });
  return { slots: next, changed };
}

/** Parse one side of a slot: "H:MM" or "HH:MM" (24h) → minutes from midnight */
export function parseClock24ToMinutes(part: string): number {
  const t = part.trim();
  const [hRaw, mRaw = '0'] = t.split(':');
  const h = parseInt(hRaw, 10);
  const m = parseInt(String(mRaw).replace(/\D/g, '') || '0', 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  const clampedH = Math.max(0, Math.min(23, h));
  const clampedM = Math.max(0, Math.min(59, m));
  return clampedH * 60 + clampedM;
}

/** Sort key: start of slot (later first, matching previous descending UI order) */
export function timeSlotStartMinutesForSort(slot: string): number {
  const [start] = slot.split(' - ');
  return parseClock24ToMinutes(start || '0:00');
}

export function parseTimeSlotRangeMinutes(slot: string): { start: number; end: number } {
  const parts = slot.split(' - ').map((p) => p.trim());
  if (parts.length < 2) return { start: 0, end: 0 };
  return {
    start: parseClock24ToMinutes(parts[0]),
    end: parseClock24ToMinutes(parts[1]),
  };
}
