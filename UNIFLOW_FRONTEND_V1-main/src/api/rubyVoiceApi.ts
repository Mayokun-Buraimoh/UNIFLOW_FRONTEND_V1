import { getApiBaseUrl } from '../constants/apiBaseUrl';
import type { WeeklyScheduleSnapshot } from '../utils/weeklyScheduleSnapshot';

export interface RubyVoiceSessionStart {
  session_id: string;
}

export interface RubyGreetingResponse {
  message: string;
  audioBase64: string;
  audioMimeType: string;
}

export interface RubyVoiceTurnResponse {
  transcript: string;
  message: string;
  audioBase64: string;
  audioMimeType: string;
  sessionId: string;
  mutations: { tasks: boolean; events: boolean };
  debug?: { toolRounds: number };
}

function buildUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function bearerHeaders(json = true): HeadersInit {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('uniflow_token') : null;
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function startRubyVoiceSession(
  timezone: string,
  weeklySchedule?: WeeklyScheduleSnapshot | null
): Promise<RubyVoiceSessionStart> {
  const body: Record<string, unknown> = { action: 'start', timezone };
  if (weeklySchedule) body.weekly_schedule = weeklySchedule;
  const res = await fetch(buildUrl('/voice/session'), {
    method: 'POST',
    headers: bearerHeaders(true),
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return JSON.parse(text) as RubyVoiceSessionStart;
}

/**
 * Push an updated weekly-schedule snapshot to an open Ruby session — call this
 * whenever the user edits their schedule mid-session so Ruby's
 * `get_todays_classes` tool keeps returning fresh data without forcing a
 * session restart.
 */
export async function refreshRubyVoiceSessionSchedule(
  sessionId: string,
  weeklySchedule: WeeklyScheduleSnapshot
): Promise<void> {
  await fetch(buildUrl('/voice/session'), {
    method: 'POST',
    headers: bearerHeaders(true),
    body: JSON.stringify({ action: 'refresh_schedule', session_id: sessionId, weekly_schedule: weeklySchedule }),
  });
}

export async function endRubyVoiceSession(sessionId: string): Promise<void> {
  await fetch(buildUrl('/voice/session'), {
    method: 'POST',
    headers: bearerHeaders(true),
    body: JSON.stringify({ action: 'end', session_id: sessionId }),
  });
}

export async function fetchRubyGreeting(): Promise<RubyGreetingResponse> {
  const res = await fetch(buildUrl('/voice/greeting'), {
    method: 'POST',
    headers: bearerHeaders(true),
    body: JSON.stringify({}),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return JSON.parse(text) as RubyGreetingResponse;
}

export async function postRubyVoiceTurn(sessionId: string, audioBlob: Blob, filename: string): Promise<RubyVoiceTurnResponse> {
  const form = new FormData();
  form.append('session_id', sessionId);
  form.append('audio', audioBlob, filename);

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('uniflow_token') : null;
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(buildUrl('/voice/turn'), {
    method: 'POST',
    headers,
    body: form,
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return JSON.parse(text) as RubyVoiceTurnResponse;
}

export async function postRubyVoiceTurnText(sessionId: string, transcript: string): Promise<RubyVoiceTurnResponse> {
  const res = await fetch(buildUrl('/voice/turn-text'), {
    method: 'POST',
    headers: bearerHeaders(true),
    body: JSON.stringify({ session_id: sessionId, transcript }),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return JSON.parse(text) as RubyVoiceTurnResponse;
}
