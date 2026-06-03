/**
 * Single owner for Capacitor / Web Speech STT sessions (Ruby live captions only).
 */

import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

import { isSpeechRecognitionSupported } from './SpeechService';

export type SpeechSessionMode = 'caption';

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: {
    results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } };
  }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

interface ActiveSession {
  mode: SpeechSessionMode;
  stop: () => void;
}

let activeSession: ActiveSession | null = null;
let releaseChain: Promise<void> = Promise.resolve();

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function permissionOk(state: string): boolean {
  return state === 'granted' || state === 'limited';
}

function isOngoingSpeechError(err: unknown): boolean {
  const msg =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message?: string }).message)
      : String(err);
  return msg.toLowerCase().includes('ongoing speech recognition');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopNativeSpeechRecognition(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SpeechRecognition.stop();
  } catch {
    /* noop */
  }
}

/** Release whichever STT session is active and wait for native plugin to settle. */
export async function releaseSpeechSession(): Promise<void> {
  releaseChain = releaseChain.then(async () => {
    const current = activeSession;
    activeSession = null;
    if (current) {
      current.stop();
    }
    await stopNativeSpeechRecognition();
    await delay(250);
  });
  await releaseChain;
}

/** RECORD_AUDIO on Android; mic + speech on iOS — does not require STT to be available. */
export async function ensureRecordAudioPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    const perm = await SpeechRecognition.requestPermissions();
    if (permissionOk(perm.speechRecognition)) return true;
  } catch {
    /* fall through to check */
  }

  try {
    const checked = await SpeechRecognition.checkPermissions();
    return permissionOk(checked.speechRecognition);
  } catch {
    return false;
  }
}

export async function ensureSpeechPermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    const { available } = await SpeechRecognition.available();
    if (!available) return false;
  } catch {
    return false;
  }

  return ensureRecordAudioPermission();
}

async function startNativeRecognition(
  mode: SpeechSessionMode,
  onText: (text: string) => void
): Promise<{ stop: () => void } | null> {
  const permitted = await ensureSpeechPermissions();
  if (!permitted) return null;

  const lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
  let partialListener: PluginListenerHandle | undefined;
  let stopped = false;

  const cleanupListener = async () => {
    try {
      await partialListener?.remove();
    } catch {
      /* noop */
    }
    partialListener = undefined;
  };

  const attachAndStart = async () => {
    partialListener = await SpeechRecognition.addListener('partialResults', (data) => {
      const raw = data.matches?.[0];
      const text = typeof raw === 'string' ? raw : '';
      const trimmed = text.replace(/\s+/g, ' ').trim();
      if (trimmed) onText(trimmed);
    });

    await SpeechRecognition.start({
      language: lang,
      partialResults: true,
      popup: false,
      maxResults: 5,
    });
  };

  try {
    await attachAndStart();
  } catch (err) {
    await cleanupListener();
    if (isOngoingSpeechError(err)) {
      await stopNativeSpeechRecognition();
      await delay(350);
      try {
        await attachAndStart();
      } catch {
        await cleanupListener();
        return null;
      }
    } else {
      return null;
    }
  }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (activeSession?.mode === mode) {
      activeSession = null;
    }
    void (async () => {
      await stopNativeSpeechRecognition();
      await cleanupListener();
    })();
  };

  activeSession = { mode, stop };
  return { stop };
}

function startWebRecognition(mode: SpeechSessionMode, onText: (text: string) => void): { stop: () => void } | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor || !isSpeechRecognitionSupported()) return null;

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

  let running = true;

  rec.onresult = (event) => {
    let finalText = '';
    let interimText = '';
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      const piece = (result[0]?.transcript ?? '').replace(/\s+/g, ' ').trim();
      if (!piece) continue;
      if (result.isFinal) finalText += `${finalText ? ' ' : ''}${piece}`;
      else interimText += `${interimText ? ' ' : ''}${piece}`;
    }
    const combined = [finalText, interimText].filter(Boolean).join(' ').trim();
    if (combined) onText(combined);
  };

  rec.onerror = () => undefined;

  rec.onend = () => {
    if (!running) return;
    try {
      rec.start();
    } catch {
      /* noop */
    }
  };

  try {
    rec.start();
  } catch {
    return null;
  }

  const stop = () => {
    if (!running) return;
    running = false;
    if (activeSession?.mode === mode) {
      activeSession = null;
    }
    try {
      rec.stop();
    } catch {
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    }
  };

  activeSession = { mode, stop };
  return { stop };
}

export async function acquireSpeechSession(
  mode: SpeechSessionMode,
  onText: (text: string) => void
): Promise<{ stop: () => void } | null> {
  await releaseSpeechSession();

  if (Capacitor.isNativePlatform()) {
    return startNativeRecognition(mode, onText);
  }

  return startWebRecognition(mode, onText);
}
