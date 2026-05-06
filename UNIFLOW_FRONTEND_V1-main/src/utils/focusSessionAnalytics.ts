import { getWeekStartPreference, type WeekStartPreference } from './appPreferences';

export interface FocusSessionRecord {
  id: string;
  noteId?: string | null;
  courseId?: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  minutesRead: number;
  courseName: string;
  documentName: string;
  quizScorePercent: number | null;
}

const STORAGE_KEY = 'uniflow_focus_session_records';

export const getFocusSessionRecords = (): FocusSessionRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveFocusSessionRecord = (record: FocusSessionRecord) => {
  const existing = getFocusSessionRecords();
  const nextRecords = [record, ...existing].slice(0, 250);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
};

export const getStartOfWeek = (date: Date, weekStartsOn?: WeekStartPreference) => {
  const mode = weekStartsOn ?? getWeekStartPreference();
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const diff = mode === 'Monday' ? (day === 0 ? -6 : 1 - day) : -day;
  weekStart.setDate(weekStart.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

export const getEndOfWeek = (date: Date) => {
  const weekEnd = getStartOfWeek(date);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return weekEnd;
};

export const getCurrentWeekFocusSessions = (referenceDate = new Date()) => {
  const weekStart = getStartOfWeek(referenceDate);
  const weekEnd = getEndOfWeek(referenceDate);

  return getFocusSessionRecords().filter((record) => {
    const endedAt = new Date(record.endedAt);
    return endedAt >= weekStart && endedAt < weekEnd;
  });
};
