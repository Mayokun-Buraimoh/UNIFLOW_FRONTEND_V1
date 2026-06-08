import { useCallback, useEffect, useRef, useState } from 'react';

import {
  endRubyVoiceSession,
  fetchRubyGreeting,
  refreshRubyVoiceSessionSchedule,
  startRubyVoiceSession,
} from '../api/rubyVoiceApi';
import {
  RubyVoiceRealtimeClient,
  type RubyRealtimeMutations,
  type RubyRealtimeState,
} from '../services/rubyVoiceRealtimeClient';
import { readWeeklyScheduleSnapshot } from '../utils/weeklyScheduleSnapshot';

export type RubyVoicePhase =
  | 'idle'
  | 'greeting_playing'
  | 'listening'
  | 'uploading'
  | 'thinking'
  | 'speaking'
  | 'error';

function playBase64Audio(
  audioBase64: string,
  audioMimeType: string,
  onAudioCreated?: (audio: HTMLAudioElement) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `data:${audioMimeType};base64,${audioBase64}`;
    const audio = new Audio(url);
    onAudioCreated?.(audio);
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

function mapRealtimeStateToPhase(state: RubyRealtimeState): RubyVoicePhase {
  switch (state) {
    case 'listening':
      return 'listening';
    case 'processing':
      return 'thinking';
    case 'responding':
      return 'speaking';
    default:
      return 'idle';
  }
}

function normalizeVoiceText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isEchoOfTranscript(message: string, transcript: string): boolean {
  const normalizedMessage = normalizeVoiceText(message);
  const normalizedTranscript = normalizeVoiceText(transcript);
  return !!normalizedMessage && normalizedMessage === normalizedTranscript;
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
  const realtimeClientRef = useRef<RubyVoiceRealtimeClient | null>(null);
  const assistantMessageRef = useRef('');
  const transcriptRef = useRef('');
  const assistantEchoSuppressedRef = useRef(false);
  const audioQueueRef = useRef<Array<{ text: string; audioBase64: string; audioMimeType: string }>>([]);
  const audioPlayingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const dispatchMutations = useCallback((m: RubyRealtimeMutations) => {
    if (m.tasks) window.dispatchEvent(new Event('uniflow_tasks_updated'));
    if (m.events) window.dispatchEvent(new Event('uniflow_events_updated'));
    if (m.plans) window.dispatchEvent(new Event('uniflow_plans_updated'));
    if (m.courses) window.dispatchEvent(new Event('uniflow_courses_updated'));
    if (m.schedule) window.dispatchEvent(new Event('weeklyScheduleUpdated'));
  }, []);

  const playReply = useCallback(async (message: string, audioBase64: string, audioMimeType: string) => {
    try {
      await playBase64Audio(audioBase64, audioMimeType, (audio) => {
        currentAudioRef.current = audio;
      });
    } catch (e) {
      console.warn('Ruby TTS playback failed, using speech fallback', e);
      await speakFallback(message);
    } finally {
      currentAudioRef.current = null;
    }
  }, []);

  const stopAudioPlayback = useCallback(() => {
    audioQueueRef.current = [];
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch {
        /* noop */
      }
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    }
    audioPlayingRef.current = false;
  }, []);

  const drainAudioQueue = useCallback(async () => {
    if (audioPlayingRef.current) return;
    audioPlayingRef.current = true;
    try {
      while (audioQueueRef.current.length > 0 && !cancelledRef.current) {
        const next = audioQueueRef.current.shift();
        if (!next) continue;
        setPhase('speaking');
        await playReply(next.text, next.audioBase64, next.audioMimeType);
      }
    } finally {
      audioPlayingRef.current = false;
      if (!cancelledRef.current) setPhase('listening');
    }
  }, [playReply]);

  const handleMutations = useCallback(
    (mutations?: RubyRealtimeMutations) => {
      if (!mutations) return;
      dispatchMutations({
        tasks: !!mutations.tasks,
        events: !!mutations.events,
        plans: !!mutations.plans,
        courses: !!mutations.courses,
        schedule: !!mutations.schedule,
      });
    },
    [dispatchMutations]
  );

  useEffect(() => {
    onPhaseForNav?.(mapRubyPhaseToAssistantPhase(phase));
  }, [phase, onPhaseForNav]);

  useEffect(() => {
    assistantMessageRef.current = assistantMessage;
  }, [assistantMessage]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (!open) {
      cancelledRef.current = true;
      stopAudioPlayback();
      void realtimeClientRef.current?.stop().catch(() => undefined);
      realtimeClientRef.current = null;
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

        const realtimeClient = new RubyVoiceRealtimeClient({
          sessionId: session_id,
          timezone: tz,
          weeklySchedule,
          onTranscriptPartial: (text) => {
            if (!cancelledRef.current) {
              transcriptRef.current = text;
              setTranscript(text);
            }
          },
          onTranscriptFinal: (text) => {
            if (!cancelledRef.current) {
              transcriptRef.current = text;
              setTranscript(text);
            }
          },
          onAssistantPartial: (text) => {
            if (!cancelledRef.current) {
              if (isEchoOfTranscript(text, transcriptRef.current)) return;
              assistantEchoSuppressedRef.current = false;
              setAssistantMessage(text);
              setPhase('thinking');
            }
          },
          onAssistantMutations: (mutations) => {
            if (cancelledRef.current) return;
            handleMutations(mutations);
          },
          onAssistantFinal: (text, mutations) => {
            if (cancelledRef.current) return;
            if (isEchoOfTranscript(text, transcriptRef.current)) {
              assistantEchoSuppressedRef.current = true;
              setAssistantMessage("I'm listening. What would you like me to do?");
              handleMutations(mutations);
              return;
            }
            assistantEchoSuppressedRef.current = false;
            setAssistantMessage(text);
            handleMutations(mutations);
          },
          onAssistantAudio: (audioBase64, audioMimeType) => {
            if (cancelledRef.current) return;
            if (
              assistantEchoSuppressedRef.current ||
              isEchoOfTranscript(assistantMessageRef.current, transcriptRef.current)
            ) {
              assistantEchoSuppressedRef.current = false;
              return;
            }
            audioQueueRef.current.push({
              text: assistantMessageRef.current || '...',
              audioBase64,
              audioMimeType,
            });
            void drainAudioQueue();
          },
          onAssistantInterrupted: () => {
            stopAudioPlayback();
            if (!cancelledRef.current) setPhase('listening');
          },
          onState: (state) => {
            if (cancelledRef.current) return;
            setPhase(mapRealtimeStateToPhase(state));
          },
          onError: (message) => {
            if (cancelledRef.current) return;
            setError(message);
            setPhase('error');
          },
        });

        realtimeClientRef.current = realtimeClient;
        await realtimeClient.start();
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
      stopAudioPlayback();
      window.removeEventListener('weeklyScheduleUpdated', onScheduleUpdated);
      void realtimeClientRef.current?.stop().catch(() => undefined);
      realtimeClientRef.current = null;
      const sid = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sid) void endRubyVoiceSession(sid).catch(() => undefined);
    };
  }, [open, userId, playReply, handleMutations, drainAudioQueue, stopAudioPlayback]);

  const submitText = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || !sessionIdRef.current || cancelledRef.current || !realtimeClientRef.current) return;
      try {
        setPhase('thinking');
        setTranscript(q);
        stopAudioPlayback();
        realtimeClientRef.current.interruptAssistant();
        realtimeClientRef.current.submitText(q);
        if (!cancelledRef.current) setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed';
        setError(msg);
        setPhase('error');
      }
    },
    [stopAudioPlayback]
  );

  return {
    phase,
    transcript,
    assistantMessage,
    error,
    submitText,
  };
}
