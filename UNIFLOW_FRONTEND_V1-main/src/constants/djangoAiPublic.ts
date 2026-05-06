/**
 * Django UNIFLOW_AI base URL for REST (e.g. voice TTS, Chatbot). Mirrors UNIFLOW_FRONTEND.
 */

import { Capacitor } from '@capacitor/core';

export const DJANGO_AI_PUBLIC_ORIGIN = 'https://uniflow-ai.onrender.com';

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/** True when a baked-in `.env` loopback URL must not be used (device / production build). */
function forcePublicDjangoOverLoopbackEnv(): boolean {
  return import.meta.env.PROD || Capacitor.isNativePlatform();
}

function isLoopbackHttpUrl(url: string): boolean {
  try {
    const u = new URL(url.includes('://') ? url : `http://${url}`);
    return (u.protocol === 'http:' || u.protocol === 'https:') && isLoopbackHostname(u.hostname);
  } catch {
    return false;
  }
}

export function resolveDjangoAiOrigin(): string {
  const fromEnv = import.meta.env.VITE_DJANGO_API_URL?.trim();
  if (fromEnv) {
    const normalized = fromEnv.replace(/\/+$/, '');
    if (forcePublicDjangoOverLoopbackEnv() && isLoopbackHttpUrl(normalized)) {
      return DJANGO_AI_PUBLIC_ORIGIN.replace(/\/+$/, '');
    }
    return normalized;
  }
  return DJANGO_AI_PUBLIC_ORIGIN.replace(/\/+$/, '');
}

/** REST base: `…/api/v1` */
export function resolveAiApiRoot(): string {
  const explicit = import.meta.env.VITE_AI_API_URL?.trim().replace(/\/$/, '');
  if (explicit && !(forcePublicDjangoOverLoopbackEnv() && isLoopbackHttpUrl(explicit))) {
    if (/\/api\/v\d+$/i.test(explicit)) return explicit;
    return `${explicit}/api/v1`;
  }
  const base = resolveDjangoAiOrigin();
  if (/\/api\/v\d+$/i.test(base)) return base;
  return `${base}/api/v1`;
}
