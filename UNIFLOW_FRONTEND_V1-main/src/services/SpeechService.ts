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
  private lastDeliveredTranscript = '';

  private static normalizeChunk(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private static clampRepeatedTokens(text: string): string {
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return text;
    const out: string[] = [];
    let repeatCount = 0;
    for (const token of parts) {
      const prev = out[out.length - 1];
      if (prev && prev.toLowerCase() === token.toLowerCase()) {
        repeatCount += 1;
        // Keep at most 2 identical adjacent tokens (handles "very very" but blocks runaway loops).
        if (repeatCount >= 2) continue;
      } else {
        repeatCount = 0;
      }
      out.push(token);
    }
    return out.join(' ');
  }

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
    this.lastDeliveredTranscript = '';
    // iOS WebKit can re-emit prior chunks aggressively in continuous mode.
    // One-shot recognition is more stable for the Siri-like quick prompt UX.
    rec.continuous = false;
    // On iOS WebKit this reduces duplicated interim noise.
    rec.interimResults = false;
    rec.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

    rec.onresult = (event: SpeechRecognitionResultEvent) => {
      // Build transcript from the full result list to avoid duplicate accumulation
      // when iOS WebKit replays final chunks across events.
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = SpeechRecognitionSession.normalizeChunk(result[0]?.transcript ?? '');
        if (!piece) continue;
        if (result.isFinal) finalText += `${finalText ? ' ' : ''}${piece}`;
        else interimText += `${interimText ? ' ' : ''}${piece}`;
      }

      const combined = SpeechRecognitionSession.clampRepeatedTokens(SpeechRecognitionSession.normalizeChunk(
        `${finalText}${finalText && interimText ? ' ' : ''}${interimText}`
      ));
      if (!combined) return;

      // Suppress duplicate callbacks from engines that emit unchanged transcripts repeatedly.
      if (combined === this.lastDeliveredTranscript) return;
      this.lastDeliveredTranscript = combined;

      // Treat it as final when there's no interim segment left.
      onResult(combined, !interimText);
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = event.error || 'error';
      if (code === 'aborted') {
        return;
      }
      if (code === 'no-speech') {
        onError('no-speech');
        return;
      }
      onError(code);
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
    this.lastDeliveredTranscript = '';
  }

  abort(): void {
    if (!this.recognition) return;
    try {
      this.recognition.abort();
    } catch {
      /* noop */
    }
    this.recognition = null;
    this.lastDeliveredTranscript = '';
  }
}
