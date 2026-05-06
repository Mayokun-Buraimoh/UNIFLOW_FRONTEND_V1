import config from '../config/environment';
import { BACKEND_ORIGIN_PRODUCTION } from '../constants/apiBaseUrl';

export const RECORDER_SLICE_MS = 3000;

export function voiceSocketOrigin(): string {
  const raw = String(config.API_BASE_URL || '').trim().replace(/\/$/, '');
  try {
    const u = new URL(raw);
    return u.origin;
  } catch {
    return BACKEND_ORIGIN_PRODUCTION;
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const s = r.result as string;
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(new Error('read blob failed'));
    r.readAsDataURL(blob);
  });
}

export function pickRecorderMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return '';
}

export function isAccessTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    let payload = parts[1];
    const pad = payload.length % 4;
    if (pad) payload += '='.repeat(4 - pad);
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(payload)) as { exp?: number };
    if (typeof json.exp !== 'number') return false;
    return json.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

export function notifyTasksRefresh(): void {
  try {
    window.dispatchEvent(new Event('uniflow_tasks_updated'));
  } catch {
    /* noop */
  }
}

export function mergeVoiceTasksLocal(tasks: Record<string, unknown>[]): void {
  try {
    const raw = localStorage.getItem('uniflow_tasks');
    const existing = raw ? JSON.parse(raw) : [];
    const next = [...tasks, ...(Array.isArray(existing) ? existing : [])];
    localStorage.setItem('uniflow_tasks', JSON.stringify(next));
  } catch (e) {
    console.error('[voice] merge tasks localStorage failed', e);
  }
}

export function mergeVoiceTasksCompletedLocal(tasks: Record<string, unknown>[]): void {
  try {
    if (!Array.isArray(tasks) || !tasks.length) return;
    const raw = localStorage.getItem('uniflow_tasks');
    const existing = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(existing)) return;
    const byId = new Map(tasks.map((t) => [String(t.id ?? ''), t]));
    const next = existing.map((row: Record<string, unknown>) => {
      const id = String(row.id ?? '');
      const upd = byId.get(id);
      if (!upd) return row;
      return {
        ...row,
        ...upd,
        status: (upd.status as string) || 'completed',
        completed: true,
      };
    });
    localStorage.setItem('uniflow_tasks', JSON.stringify(next));
  } catch (e) {
    console.error('[voice] merge completed tasks localStorage failed', e);
  }
}

export function mergeVoiceEventsLocal(events: Record<string, unknown>[]): void {
  try {
    const raw = localStorage.getItem('uniflow_events');
    const existing = raw ? JSON.parse(raw) : [];
    const mapped = events.map((e) => ({
      id: String(e.id ?? ''),
      title: String(e.title ?? ''),
      time: String(e.time ?? ''),
      date: String(e.date ?? ''),
      completed: false,
    }));
    const next = [...mapped, ...(Array.isArray(existing) ? existing : [])];
    localStorage.setItem('uniflow_events', JSON.stringify(next));
    window.dispatchEvent(new Event('uniflow_events_updated'));
  } catch (e) {
    console.error('[voice] merge events localStorage failed', e);
  }
}

export function mergeVoiceEventsCompletedLocal(events: Record<string, unknown>[]): void {
  try {
    if (!Array.isArray(events) || !events.length) return;
    const raw = localStorage.getItem('uniflow_events');
    const existing = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(existing)) return;
    const byId = new Map(events.map((e) => [String(e.id ?? ''), e]));
    const next = existing.map((row: Record<string, unknown>) => {
      const id = String(row.id ?? '');
      const upd = byId.get(id);
      if (!upd) return row;
      return {
        ...row,
        ...upd,
        completed: true,
      };
    });
    localStorage.setItem('uniflow_events', JSON.stringify(next));
    window.dispatchEvent(new Event('uniflow_events_updated'));
  } catch (e) {
    console.error('[voice] merge completed events localStorage failed', e);
  }
}

/** When `VITE_VOICE_SOCKET` is not `'0'`, try Socket.IO + server Whisper first, then fall back to on-device STT. */
export function isVoiceSocketEnabled(): boolean {
  return import.meta.env.VITE_VOICE_SOCKET !== '0';
}
