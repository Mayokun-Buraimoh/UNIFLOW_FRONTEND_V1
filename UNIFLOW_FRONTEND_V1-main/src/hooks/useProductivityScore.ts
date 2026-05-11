import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTasks } from './useTasks';
import { usePlans } from '../contexts/PlanContext';
import type { Plan, Objective } from '../contexts/PlanContext';
import { USER_SCOPED_STORAGE_CLEARED_EVENT } from '../utils/clearUserScopedStorage';

/**
 * Today's productivity score, expressed as 0–100.
 *
 * Rule (clear and predictable):
 *   numerator   = items that count as "done today"
 *   denominator = items that count as "due today"
 *   score       = round(100 * numerator / denominator), 0 if denominator is 0
 *
 * What counts as "due today":
 *   - Backend tasks whose dueDate (or createdAt fallback) is today
 *   - Calendar events whose date is today
 *   - Plan targets/tasks whose frequency is 'daily'
 *
 * What counts as "done today":
 *   - Tasks with status === 'completed'
 *   - Events with completed === true
 *   - Daily plan items where completedAt is today (so completing a daily
 *     routine yesterday doesn't keep crediting today's score)
 *
 * Weekly plan items are intentionally excluded from the *daily* productivity
 * score — they're not due every day, so including them either inflates the
 * denominator on most days (and pulls the score down) or gets dropped from it
 * entirely (the previous bug, which made completing a weekly target *reduce*
 * total without crediting it).
 *
 * Reactivity: the hook reacts to `useTasks` and `usePlans` automatically.
 * For events (which live in localStorage), it listens to:
 *   - 'storage' (cross-tab updates)
 *   - 'uniflow_events_updated' (in-tab updates dispatched by voice/sync code)
 *   - window 'focus' and document 'visibilitychange' (catch-all so the score
 *     refreshes when the user returns from another screen)
 *   - the user-scoped-storage cleared event (logout / account switch)
 */
export function useProductivityScore() {
  const { tasks: backendTasks } = useTasks();
  const { plans } = usePlans();
  const [events, setEvents] = useState<Array<{ date?: string; completed?: boolean }>>([]);

  const loadEvents = useCallback(() => {
    try {
      const raw = localStorage.getItem('uniflow_events');
      const parsed = raw ? JSON.parse(raw) : [];
      setEvents(Array.isArray(parsed) ? parsed : []);
    } catch {
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    loadEvents();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'uniflow_events' || e.key === null) loadEvents();
    };
    const onCustom = () => loadEvents();
    const onFocus = () => loadEvents();
    const onVisibility = () => {
      if (!document.hidden) loadEvents();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('uniflow_events_updated', onCustom);
    window.addEventListener('focus', onFocus);
    window.addEventListener(USER_SCOPED_STORAGE_CLEARED_EVENT, onCustom);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('uniflow_events_updated', onCustom);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(USER_SCOPED_STORAGE_CLEARED_EVENT, onCustom);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadEvents]);

  const score = useMemo(() => {
    const today = new Date();
    const todayKey = toLocalDateKey(today);

    const isDateToday = (raw: string | undefined | null): boolean => {
      if (!raw) return false;
      const parsed = parseFlexibleDate(raw);
      if (!parsed) return false;
      return toLocalDateKey(parsed) === todayKey;
    };

    let total = 0;
    let completed = 0;

    // Tasks due today
    const todayTasks = backendTasks.filter((t) => isDateToday(t.dueDate || t.createdAt));
    total += todayTasks.length;
    completed += todayTasks.filter((t) => t.status === 'completed').length;

    // Calendar events on today
    const todayEvents = events.filter((e) => isDateToday(e.date));
    total += todayEvents.length;
    completed += todayEvents.filter((e) => e.completed === true).length;

    // Daily plan routines (targets + tasks). Weekly items are excluded — see
    // the docstring at the top of this file for why.
    const dailyPlanItems: Objective[] = plans.flatMap((plan: Plan) => [
      ...plan.targets.filter((t: Objective) => t.frequency === 'daily'),
      ...plan.tasks.filter((t: Objective) => t.frequency === 'daily'),
    ]);
    total += dailyPlanItems.length;
    completed += dailyPlanItems.filter(
      (p: Objective) => p.completed && isDateToday(p.completedAt)
    ).length;

    if (total === 0) return 0;
    // Clamp to 0–100 in case of any unexpected data drift (e.g. duplicates).
    const raw = Math.round((completed / total) * 100);
    return Math.max(0, Math.min(100, raw));
  }, [backendTasks, events, plans]);

  return score;
}

/** Stable, locale-independent YYYY-MM-DD key in the *local* timezone. */
const toLocalDateKey = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Best-effort parser that handles the date string shapes used across the app:
 *   - ISO timestamps from the backend (`new Date()` handles them)
 *   - 'YYYY-MM-DD' (calendar events written by Home.tsx)
 *   - 'DD/MM/YYYY' or 'D/M/YYYY' (legacy / locale-formatted strings)
 *   - locale strings produced by `Date.prototype.toLocaleDateString()`
 *
 * Returns null when the input is unparseable, so callers can skip gracefully.
 */
const parseFlexibleDate = (raw: string): Date | null => {
  if (!raw || typeof raw !== 'string') return null;

  // Fast path: ISO-ish strings ('2026-05-11', '2026-05-11T...').
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return new Date(year, month - 1, day);
    }
  }

  // Native parse first (handles ISO timestamps with time, RFC strings, etc.).
  const native = new Date(raw);
  if (!Number.isNaN(native.getTime())) {
    return native;
  }

  // Fallback for slash-separated locale dates. We assume DD/MM/YYYY because
  // that's what `Date.prototype.toLocaleDateString()` produces in most non-US
  // locales the app is likely to encounter; if the components are unambiguous
  // (i.e. the first part is > 12) we use it as the day, otherwise we still
  // prefer DD/MM to match the rest of the codebase (see Home.parseEventDate).
  if (raw.includes('/')) {
    const parts = raw.split('/');
    if (parts.length === 3) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      const year = Number(parts[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(year)) {
        const day = a;
        const month = b;
        const candidate = new Date(year, month - 1, day);
        if (!Number.isNaN(candidate.getTime())) return candidate;
      }
    }
  }

  return null;
};
