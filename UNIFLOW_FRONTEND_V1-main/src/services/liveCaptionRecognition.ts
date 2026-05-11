/**
 * Live captions for Ruby (display only). Backend still transcribes with Whisper.
 * Web: Web Speech API. Native iOS/Android: @capacitor-community/speech-recognition.
 */

import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

import { isSpeechRecognitionSupported } from './SpeechService';

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

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function startWebLiveCaptionRecognition(onText: (text: string) => void): { stop: () => void } {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor || !isSpeechRecognitionSupported()) {
    return { stop: () => undefined };
  }

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

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
  rec.onend = () => undefined;

  try {
    rec.start();
  } catch {
    return { stop: () => undefined };
  }

  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          /* noop */
        }
      }
    },
  };
}

function permissionOk(state: string): boolean {
  return state === 'granted' || state === 'limited';
}

async function startNativeLiveCaptionRecognition(onText: (text: string) => void): Promise<{ stop: () => void }> {
  let partialListener: PluginListenerHandle | undefined;

  const cleanupListener = async () => {
    try {
      await partialListener?.remove();
    } catch {
      /* noop */
    }
    partialListener = undefined;
  };

  try {
    const { available } = await SpeechRecognition.available();
    if (!available) {
      return { stop: () => undefined };
    }

    const checked = await SpeechRecognition.checkPermissions();
    const perm = permissionOk(checked.speechRecognition)
      ? checked
      : await SpeechRecognition.requestPermissions();

    if (!permissionOk(perm.speechRecognition)) {
      return { stop: () => undefined };
    }
  } catch {
    return { stop: () => undefined };
  }

  const lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

  try {
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
  } catch {
    await cleanupListener();
    return { stop: () => undefined };
  }

  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      void (async () => {
        try {
          await SpeechRecognition.stop();
        } catch {
          /* noop */
        }
        await cleanupListener();
      })();
    },
  };
}

/**
 * Stream live captions into onText. On native, awaits speech permission and recognizer start.
 */
export async function startLiveCaptionRecognition(
  onText: (text: string) => void
): Promise<{ stop: () => void }> {
  if (Capacitor.isNativePlatform()) {
    return startNativeLiveCaptionRecognition(onText);
  }
  return startWebLiveCaptionRecognition(onText);
}
