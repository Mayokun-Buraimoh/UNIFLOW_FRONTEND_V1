import { useCallback, useEffect, useRef, useState } from 'react';
import {
  endRubyVoiceSession,
  fetchRubyGreeting,
  postRubyVoiceTurn,
  postRubyVoiceTurnText,
  refreshRubyVoiceSessionSchedule,
  startRubyVoiceSession,
} from '../api/rubyVoiceApi';
import { startLiveCaptionRecognition } from '../services/liveCaptionRecognition';
import { readWeeklyScheduleSnapshot } from '../utils/weeklyScheduleSnapshot';

export type RubyVoicePhase =
  | 'idle'
  | 'greeting_playing'
  | 'listening'
  | 'uploading'
  | 'thinking'
  | 'speaking'
  | 'error';

const SILENCE_MS = 2000;
const MIN_RMS = 0.02;
const MAX_RECORD_MS = 60_000;
const NO_SPEECH_GIVEUP_MS = 25_000;
const MIN_AUDIO_BYTES = 1500;

function pickRecorderMime(): string | undefined {
  const c = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];
  for (const m of c) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

function playBase64Audio(audioBase64: string, audioMimeType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `data:${audioMimeType};base64,${audioBase64}`;
    const audio = new Audio(url);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('Audio playback failed'));
    void audio.play().catch(reject);
  });
}

function speakFallback(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

async function recordUtteranceUntilSilence(
  cancelled: () => boolean,
  onLiveTranscript?: (text: string) => void
): Promise<Blob | null> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickRecorderMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);

  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);

  const liveCaptions = onLiveTranscript ? await startLiveCaptionRecognition(onLiveTranscript) : null;

  return new Promise((resolve) => {
    let silenceStart: number | null = null;
    let speechDetected = false;
    let raf = 0;
    const recordStart = performance.now();

    const stopAll = () => {
      liveCaptions?.stop();
      cancelAnimationFrame(raf);
      if (rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          /* noop */
        }
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => undefined);
    };

    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
      resolve(blob.size >= MIN_AUDIO_BYTES ? blob : null);
    };

    const tick = () => {
      if (cancelled()) {
        stopAll();
        resolve(null);
        return;
      }

      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i]! - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);

      const now = performance.now();

      if (rms >= MIN_RMS) {
        speechDetected = true;
        silenceStart = null;
      } else if (speechDetected) {
        if (silenceStart === null) silenceStart = now;
        else if (now - silenceStart >= SILENCE_MS) {
          stopAll();
          return;
        }
      } else if (!speechDetected && now - recordStart >= NO_SPEECH_GIVEUP_MS) {
        stopAll();
        return;
      }

      if (now - recordStart > MAX_RECORD_MS) {
        stopAll();
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    try {
      rec.start(120);
    } catch {
      stopAll();
      resolve(null);
      return;
    }
    raf = requestAnimationFrame(tick);
  });
}

function extensionForMime(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  return 'webm';
}

export interface UseRubyVoiceSessionOptions {
  open: boolean;
  userId: string | undefined;
  onPhaseForNav?: (phase: 'idle' | 'listening' | 'processing' | 'responding') => void;
}

export function mapRubyPhaseToAssistantPhase(p: RubyVoicePhase): 'idle' | 'listening' | 'processing' | 'responding' {
  switch (p) {
    case 'greeting_playing':
    case 'speaking':
      return 'responding';
    case 'uploading':
    case 'thinking':
      return 'processing';
    case 'listening':
      return 'listening';
    default:
      return 'idle';
  }
}

export function useRubyVoiceSession({ open, userId, onPhaseForNav }: UseRubyVoiceSessionOptions) {
  const [phase, setPhase] = useState<RubyVoicePhase>('idle');
  const [transcript, setTranscript] = useState('');
  const [assistantMessage, setAssistantMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  const dispatchMutations = useCallback((m: { tasks: boolean; events: boolean }) => {
    if (m.tasks) window.dispatchEvent(new Event('uniflow_tasks_updated'));
    if (m.events) window.dispatchEvent(new Event('uniflow_events_updated'));
  }, []);

  const playReply = useCallback(async (message: string, audioBase64: string, audioMimeType: string) => {
    try {
      await playBase64Audio(audioBase64, audioMimeType);
    } catch (e) {
      console.warn('Ruby TTS playback failed, using speech fallback', e);
      await speakFallback(message);
    }
  }, []);

  useEffect(() => {
    onPhaseForNav?.(mapRubyPhaseToAssistantPhase(phase));
  }, [phase, onPhaseForNav]);

  useEffect(() => {
    if (!open) {
      cancelledRef.current = true;
      const sid = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sid) void endRubyVoiceSession(sid).catch(() => undefined);
      setPhase('idle');
      setTranscript('');
      setAssistantMessage('');
      setError(null);
      return;
    }

    if (!userId) {
      setError('Sign in to use Ruby.');
      setPhase('error');
      return;
    }

    cancelledRef.current = false;
    setError(null);
    setTranscript('');
    setAssistantMessage('');

    const run = async () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        // Snapshot the on-device weekly schedule so Ruby can answer
        // questions like "how many classes do I have today?" without us
        // having to round-trip those reads from the backend. The backend
        // happily accepts an empty/missing snapshot — Ruby just falls back
        // to telling the user it doesn't have their schedule yet.
        const weeklySchedule = readWeeklyScheduleSnapshot();
        const { session_id } = await startRubyVoiceSession(tz, weeklySchedule);
        if (cancelledRef.current) return;
        sessionIdRef.current = session_id;

        // Siri-style behavior: play the verbal introduction only on the user's
        // first invocation. Subsequent opens fall straight through to the
        // listening loop — the activation haptic + tone cue in
        // VoiceAssistantOverlay already give a non-verbal "I'm here" ack
        // (the "hmm" / chime), matching Apple's behavior.
        const introKey = `uniflow_ruby_introduced_${userId}`;
        const hasBeenIntroduced = (() => {
          try {
            return localStorage.getItem(introKey) === 'true';
          } catch {
            return false;
          }
        })();

        if (!hasBeenIntroduced) {
          setPhase('greeting_playing');
          const greeting = await fetchRubyGreeting();
          if (cancelledRef.current) return;

          setAssistantMessage(greeting.message);
          await playReply(greeting.message, greeting.audioBase64, greeting.audioMimeType);
          if (cancelledRef.current) return;

          // Only persist *after* the greeting actually finished playing — if
          // anything bailed (cancel, network, audio failure), the next open
          // will retry the intro instead of silently skipping it forever.
          try {
            localStorage.setItem(introKey, 'true');
          } catch {
            /* localStorage unavailable / quota — non-fatal */
          }
        }

        while (!cancelledRef.current && sessionIdRef.current) {
          setPhase('listening');
          setTranscript('');
          const blob = await recordUtteranceUntilSilence(
            () => cancelledRef.current,
            (live) => {
              if (!cancelledRef.current) setTranscript(live);
            }
          );
          if (cancelledRef.current) break;
          if (!blob) {
            continue;
          }

          setPhase('uploading');
          const turn = await postRubyVoiceTurn(sessionIdRef.current, blob, `ruby.${extensionForMime(blob.type)}`);
          if (cancelledRef.current) break;

          setTranscript(turn.transcript);
          setAssistantMessage(turn.message);
          dispatchMutations(turn.mutations);

          setPhase('thinking');
          setPhase('speaking');
          await playReply(turn.message, turn.audioBase64, turn.audioMimeType);
        }
      } catch (e) {
        if (cancelledRef.current) return;
        const msg = e instanceof Error ? e.message : 'Ruby session failed';
        console.error(e);
        setError(msg);
        setPhase('error');
      }
    };

    // If the user opens the Schedule tab and edits classes mid-session, push
    // a fresh snapshot to the backend so `get_todays_classes` returns the
    // updated list without the user having to close and reopen Ruby.
    const onScheduleUpdated = () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const snapshot = readWeeklyScheduleSnapshot();
      if (!snapshot) return;
      void refreshRubyVoiceSessionSchedule(sid, snapshot).catch(() => undefined);
    };
    window.addEventListener('weeklyScheduleUpdated', onScheduleUpdated);

    void run();
    return () => {
      cancelledRef.current = true;
      window.removeEventListener('weeklyScheduleUpdated', onScheduleUpdated);
      const sid = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sid) void endRubyVoiceSession(sid).catch(() => undefined);
    };
  }, [open, userId, dispatchMutations, playReply]);

  const submitText = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || !sessionIdRef.current || cancelledRef.current) return;
      try {
        setPhase('thinking');
        setTranscript(q);
        const turn = await postRubyVoiceTurnText(sessionIdRef.current, q);
        if (cancelledRef.current) return;
        setAssistantMessage(turn.message);
        dispatchMutations(turn.mutations);
        setPhase('speaking');
        await playReply(turn.message, turn.audioBase64, turn.audioMimeType);
        if (!cancelledRef.current) {
          setPhase('idle');
          setError(null);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed';
        setError(msg);
        setPhase('error');
      }
    },
    [dispatchMutations, playReply]
  );

  return {
    phase,
    transcript,
    assistantMessage,
    error,
    submitText,
  };
}
