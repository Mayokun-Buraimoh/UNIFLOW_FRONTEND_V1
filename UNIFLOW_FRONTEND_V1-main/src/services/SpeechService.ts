/**
 * Thin wrapper around the Web Speech API (SpeechRecognition).
 * Mobile WebViews may need a native plugin; this degrades gracefully.
 */

export type SpeechRecognitionResultHandler = (transcript: string, isFinal: boolean) => void;

/** Minimal typing; DOM lib may omit SpeechRecognition on some TS configs */
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export class SpeechRecognitionSession {
  private recognition: SpeechRecognitionInstance | null = null;

  start(
    onResult: SpeechRecognitionResultHandler,
    onError: (message: string) => void,
    onEnd: () => void
  ): boolean {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      onError('not-supported');
      return false;
    }

    this.stop();

    const rec = new Ctor();
    this.recognition = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

    rec.onresult = (event: SpeechRecognitionResultEvent) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? '';
        if (result.isFinal) finalChunk += piece;
        else interim += piece;
      }
      if (finalChunk) {
        onResult(finalChunk.trim(), true);
      } else if (interim) {
        onResult(interim.trim(), false);
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return;
      }
      onError(event.error || 'error');
    };

    rec.onend = () => {
      onEnd();
    };

    try {
      rec.start();
      return true;
    } catch {
      onError('start-failed');
      return false;
    }
  }

  stop(): void {
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch {
      try {
        this.recognition.abort();
      } catch {
        /* noop */
      }
    }
    this.recognition = null;
  }

  abort(): void {
    if (!this.recognition) return;
    try {
      this.recognition.abort();
    } catch {
      /* noop */
    }
    this.recognition = null;
  }
}
