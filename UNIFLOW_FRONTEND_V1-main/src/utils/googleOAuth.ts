import { Capacitor } from '@capacitor/core';
import { clearUserScopedStorageIfUserChanged, readUserIdFromStorage } from './clearUserScopedStorage';

export type GoogleOAuthReturnParams = {
  token: string | null;
  userParam: string | null;
  error: string | null;
  origin: string | null;
};

export type GoogleOAuthSignInResult =
  | { ok: true }
  | { ok: false; redirectTo: string; reason?: string };

/** API base including `/api`, e.g. https://uniflow-backend-v1.onrender.com/api */
export function getGoogleOAuthStartUrl(apiBase: string): string {
  const base = apiBase.replace(/\/$/, '');
  const start = `${base}/auth/google`;
  return Capacitor.isNativePlatform() ? `${start}?app=ios` : start;
}

/** True for iOS custom-scheme return or web `/auth/google/callback`. */
export function isGoogleOAuthReturnUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (u.includes('oauthredirect')) return true;
  if (u.includes('/auth/google/callback')) return true;
  return /\b(token|error)=/.test(u);
}

const OAUTH_PROCESSED_STORAGE_KEY = 'uniflow_oauth_last_processed';

/** Stable key so Capacitor getLaunchUrl() is not handled twice for the same sign-in. */
export function getOAuthUrlDedupeKey(rawUrl: string): string | null {
  const { token, error } = parseGoogleOAuthReturnUrl(rawUrl);
  if (error) return `error:${error}`;
  if (token) return `token:${token}`;
  const trimmed = rawUrl.trim();
  return trimmed ? `url:${trimmed.slice(0, 240)}` : null;
}

export function wasOAuthUrlProcessed(dedupeKey: string): boolean {
  try {
    return sessionStorage.getItem(OAUTH_PROCESSED_STORAGE_KEY) === dedupeKey;
  } catch {
    return false;
  }
}

export function markOAuthUrlProcessed(dedupeKey: string): void {
  try {
    sessionStorage.setItem(OAUTH_PROCESSED_STORAGE_KEY, dedupeKey);
  } catch {
    /* ignore */
  }
}

/** Parse token/user/error from https callback or `com.googleusercontent.apps.*:/oauthredirect?...`. */
export function parseGoogleOAuthReturnUrl(rawUrl: string): GoogleOAuthReturnParams {
  const queryStart = rawUrl.indexOf('?');
  const query = queryStart >= 0 ? rawUrl.slice(queryStart + 1) : '';
  const params = new URLSearchParams(query);
  return {
    token: params.get('token'),
    userParam: params.get('user'),
    error: params.get('error'),
    origin: params.get('origin'),
  };
}

/**
 * Persist Google OAuth result from redirect URL (web callback or native deep link).
 */
export async function completeGoogleOAuthSignIn(
  rawUrl: string,
  refreshUser?: () => Promise<void>,
  options?: { skipApiRefresh?: boolean },
): Promise<GoogleOAuthSignInResult> {
  const dedupeKey = getOAuthUrlDedupeKey(rawUrl);
  if (dedupeKey && wasOAuthUrlProcessed(dedupeKey)) {
    return { ok: true };
  }

  const { token, userParam, error, origin } = parseGoogleOAuthReturnUrl(rawUrl);

  if (error === 'oauth_cancelled') {
    return { ok: false, redirectTo: origin === 'signup' ? '/signup' : '/login', reason: 'cancelled' };
  }

  if (!token || !userParam) {
    return {
      ok: false,
      redirectTo: origin === 'signup' ? '/signup' : '/login',
      reason: error || 'missing_token',
    };
  }

  try {
    const previousUserId = readUserIdFromStorage();
    localStorage.removeItem('uniflow_token');
    localStorage.removeItem('uniflow_user');
    localStorage.removeItem('refreshToken');

    localStorage.setItem('uniflow_token', token);

    const userData = JSON.parse(decodeURIComponent(userParam));
    clearUserScopedStorageIfUserChanged(previousUserId, userData.id);
    localStorage.setItem('uniflow_user', JSON.stringify(userData));

    if (dedupeKey) {
      markOAuthUrlProcessed(dedupeKey);
    }

    if (refreshUser && !options?.skipApiRefresh) {
      try {
        await refreshUser();
      } catch {
        /* localStorage already updated */
      }
    }

    return { ok: true };
  } catch (e) {
    console.error('Google OAuth return handling failed:', e);
    return { ok: false, redirectTo: '/signup', reason: 'parse_error' };
  }
}
