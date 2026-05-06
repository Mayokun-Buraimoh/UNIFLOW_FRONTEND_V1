/**
 * Cached app preferences for instant reads (splash / login) before profile fetch,
 * and for week-boundary math in analytics. Kept in sync with the profile API via
 * useProfile + App Preferences save.
 */

export type WeekStartPreference = 'Sunday' | 'Monday';

export const APP_PREFERENCES_UPDATED_EVENT = 'uniflow_app_preferences_updated';

const STORAGE_KEY = 'uniflow_app_preferences_cache';

export interface CachedAppPreferences {
  defaultStartPage?: string;
  weekStart?: WeekStartPreference;
}

function notifyPreferencesUpdated() {
  try {
    window.dispatchEvent(new Event(APP_PREFERENCES_UPDATED_EVENT));
  } catch {
    /* noop */
  }
}

export function readCachedAppPreferences(): CachedAppPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      defaultStartPage: typeof o.defaultStartPage === 'string' ? o.defaultStartPage : undefined,
      weekStart: o.weekStart === 'Sunday' || o.weekStart === 'Monday' ? o.weekStart : undefined,
    };
  } catch {
    return {};
  }
}

/** Merge into cache and notify listeners (analytics, home week totals, plan progress). */
export function writeCachedAppPreferences(prefs: Partial<CachedAppPreferences>): void {
  const prev = readCachedAppPreferences();
  const next: CachedAppPreferences = { ...prev, ...prefs };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notifyPreferencesUpdated();
}

/** Call when profile loads from API so splash/login use the same defaults as the server. */
export function cacheAppPreferencesFromProfile(preferences: Record<string, unknown> | undefined | null): void {
  if (!preferences || typeof preferences !== 'object') return;
  const prev = readCachedAppPreferences();
  const next: CachedAppPreferences = { ...prev };
  if (typeof preferences.defaultStartPage === 'string') {
    next.defaultStartPage = preferences.defaultStartPage;
  }
  if (preferences.weekStart === 'Sunday' || preferences.weekStart === 'Monday') {
    next.weekStart = preferences.weekStart;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notifyPreferencesUpdated();
}

/** Maps App Preferences labels to router paths (must match InlineDropdown values). */
const DEFAULT_START_LABEL_TO_PATH: Record<string, string> = {
  Home: '/home',
  Plans: '/plans',
  Courses: '/courses',
  'Weekly Schedule': '/weekly-schedule',
  ChatBot: '/chatbot',
};

export function getDefaultStartPath(): string {
  const label = readCachedAppPreferences().defaultStartPage;
  if (label && DEFAULT_START_LABEL_TO_PATH[label]) {
    return DEFAULT_START_LABEL_TO_PATH[label];
  }
  return '/home';
}

export function getWeekStartPreference(): WeekStartPreference {
  return readCachedAppPreferences().weekStart ?? 'Monday';
}
