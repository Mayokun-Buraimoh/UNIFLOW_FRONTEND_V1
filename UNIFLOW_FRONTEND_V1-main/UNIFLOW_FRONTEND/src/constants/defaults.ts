import { Capacitor } from '@capacitor/core';
import { isTemplatedBackendUrl } from '../utils/envGuards';

/**
 * Default Node/Express backend origin (no path). Override with `VITE_BACKEND_URL` in `.env`.
 */
export const DEFAULT_BACKEND_BASE_URL = 'https://uniflow-backend-mdo3.onrender.com';

/**
 * Django (UNIFLOW_AI) public origin when `VITE_DJANGO_API_URL` is unset.
 * Override in `.env` for local Django (`http://localhost:8000` or your tunnel).
 */
export const DEFAULT_DJANGO_API_URL = 'https://uniflow-ai.onrender.com';

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/**
 * On a physical device / emulator, `localhost` in Vite env points at the phone, not your dev machine.
 * Set `VITE_NATIVE_BACKEND_ORIGIN` to a reachable origin, e.g. `http://192.168.1.50:3000` or `http://10.0.2.2:3000` (Android emulator → host).
 */
function rewriteLoopbackUrlForNative(
  url: string,
  nativeOriginEnv: string | undefined
): string {
  if (!Capacitor.isNativePlatform()) return url;

  const raw = nativeOriginEnv?.trim().replace(/\/$/, '');
  if (!raw) return url;

  let replacement: URL;
  try {
    replacement = new URL(raw.includes('://') ? raw : `http://${raw}`);
  } catch {
    return url;
  }

  try {
    const u = new URL(url);
    if (!isLoopbackHostname(u.hostname)) return url;
    u.protocol = replacement.protocol;
    u.hostname = replacement.hostname;
    u.port = replacement.port;
    return u.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

/** Replace loopback with `VITE_NATIVE_BACKEND_ORIGIN` (Express / Node port). */
export function rewriteBackendUrlForNative(url: string): string {
  return rewriteLoopbackUrlForNative(url, import.meta.env.VITE_NATIVE_BACKEND_ORIGIN);
}

/** Replace loopback with `VITE_NATIVE_DJANGO_ORIGIN` only (often `http://LAN:8000`; do not reuse Node :3000). */
export function rewriteDjangoUrlForNative(url: string): string {
  return rewriteLoopbackUrlForNative(url, import.meta.env.VITE_NATIVE_DJANGO_ORIGIN);
}

/** Host:port from `VITE_NATIVE_BACKEND_ORIGIN` for rewriting `localhost` inside JSON/OAuth URLs. */
export function nativeBackendHostForStringRewrite(): string | undefined {
  const raw = import.meta.env.VITE_NATIVE_BACKEND_ORIGIN?.trim().replace(/\/$/, '');
  if (!raw) return undefined;
  try {
    const u = new URL(raw.includes('://') ? raw : `http://${raw}`);
    return u.host;
  } catch {
    return undefined;
  }
}

function warnPlaceholderEnv(name: string): void {
  console.warn(
    `[UniFlow] ${name} is still a template (e.g. REPLACE_ME / YOUR_SUBDOMAIN). Ignoring it — set a real URL in .env and run "npm run build" + "npx cap sync" for native.`
  );
}

export function resolveBackendBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_BACKEND_URL?.trim().replace(/\/$/, '');
  if (fromEnv) {
    if (!isTemplatedBackendUrl(fromEnv)) return rewriteBackendUrlForNative(fromEnv);
    warnPlaceholderEnv('VITE_BACKEND_URL');
  }

  const apiOverride = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
  if (apiOverride) {
    const originOnly = apiOverride.replace(/\/?api\/?$/i, '');
    if (!isTemplatedBackendUrl(apiOverride) && !isTemplatedBackendUrl(originOnly)) {
      return rewriteBackendUrlForNative(originOnly);
    }
    warnPlaceholderEnv('VITE_API_URL');
  }

  return rewriteBackendUrlForNative(DEFAULT_BACKEND_BASE_URL);
}

export function resolveApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
  if (explicit) {
    if (!isTemplatedBackendUrl(explicit)) return rewriteBackendUrlForNative(explicit);
    warnPlaceholderEnv('VITE_API_URL');
  }
  return rewriteBackendUrlForNative(`${resolveBackendBaseUrl()}/api`);
}

/** Origin of the Node/Express API (no `/api` suffix). */
export function resolveBackendOrigin(): string {
  return resolveBackendBaseUrl();
}

/** Django / UNIFLOW_AI public origin (no path). Uses `VITE_DJANGO_API_URL` or default; rewrites loopback on native. */
export function resolveDjangoPublicOrigin(): string {
  const fromEnv = import.meta.env.VITE_DJANGO_API_URL?.trim().replace(/\/$/, '');
  if (fromEnv) {
    if (!isTemplatedBackendUrl(fromEnv)) return rewriteDjangoUrlForNative(fromEnv);
    warnPlaceholderEnv('VITE_DJANGO_API_URL');
  }
  return rewriteDjangoUrlForNative(DEFAULT_DJANGO_API_URL);
}

/** Base URL for AI chat client: `VITE_AI_API_URL` or `<django origin>/api/v1`. */
export function resolveAiApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_AI_API_URL?.trim().replace(/\/$/, '');
  if (explicit) {
    if (!isTemplatedBackendUrl(explicit)) return rewriteDjangoUrlForNative(explicit);
    warnPlaceholderEnv('VITE_AI_API_URL');
  }
  const django = resolveDjangoPublicOrigin().replace(/\/$/, '');
  return rewriteDjangoUrlForNative(`${django}/api/v1`);
}

/** Host:port for rewriting `localhost` in Django-related JSON (native). */
export function nativeDjangoHostForStringRewrite(): string | undefined {
  const raw = import.meta.env.VITE_NATIVE_DJANGO_ORIGIN?.trim().replace(/\/$/, '');
  if (!raw) return undefined;
  try {
    const u = new URL(raw.includes('://') ? raw : `http://${raw}`);
    return u.host;
  } catch {
    return undefined;
  }
}
