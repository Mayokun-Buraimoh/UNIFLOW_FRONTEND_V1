export const USER_SCOPED_STORAGE_CLEARED_EVENT = 'uniflow_user_scoped_storage_cleared';

/**
 * Removes cached courses, notes, PDFs, and other per-user data from localStorage.
 * Preserves app-wide preferences (language, onboarding) that are not tied to a specific account.
 */
const PRESERVED_KEYS = new Set([
  'uniflow_onboarding_completed',
  'uniflow_language',
]);

const KEY_PREFIXES_TO_REMOVE = [
  'uniflow_files_',
  'uniflow_note_data_',
  'uniflow_sticky_notes_',
  'uniflow_note_read_progress_',
  'uniflow_notes_',
];

const EXACT_KEYS_TO_REMOVE = [
  'uniflow_courses',
  'uniflow_tasks',
  'uniflow_events',
  'uniflow_jottings',
  'uniflow_focus_session_records',
  'uniflow_app_preferences_cache',
  'uniflow_plans',
  'customPlans',
  'activePlans',
  'weeklySchedule',
  'weeklyScheduleVenues',
  'weeklyTimeSlots',
  'uniflow_streak',
  'uniflow_streak_date',
  'uniflow_streak_longest',
  'uniflow_session_start',
  'uniflow_last_active_time',
  'uniflow_local_profile_picture',
  'uniflow_has_seen_schedule_onboarding',
  'uniflow_has_seen_voice_onboarding',
];

function shouldRemoveKey(key: string): boolean {
  if (PRESERVED_KEYS.has(key)) return false;
  if (EXACT_KEYS_TO_REMOVE.includes(key)) return true;
  return KEY_PREFIXES_TO_REMOVE.some((prefix) => key.startsWith(prefix));
}

export function clearUserScopedLocalStorage(): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (shouldRemoveKey(key)) {
        localStorage.removeItem(key);
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(USER_SCOPED_STORAGE_CLEARED_EVENT));
    }
  } catch (e) {
    console.warn('clearUserScopedLocalStorage: failed', e);
  }
}

/** Call after login / OAuth when the signed-in user id may differ from the previous session user. */
export function clearUserScopedStorageIfUserChanged(
  previousUserId: string | null | undefined,
  nextUserId: string | null | undefined,
): void {
  if (!nextUserId) return;
  if (previousUserId != null && previousUserId !== nextUserId) {
    clearUserScopedLocalStorage();
  }
}

export function readUserIdFromStorage(): string | null {
  try {
    const raw = localStorage.getItem('uniflow_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string };
    return parsed?.id ?? null;
  } catch {
    return null;
  }
}
