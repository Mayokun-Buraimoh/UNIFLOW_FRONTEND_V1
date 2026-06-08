import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useIonToast } from '@ionic/react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import VoiceAssistantOverlay, { type AssistantPhase } from '../components/voice-assistant/VoiceAssistantOverlay';
import { useAuth } from './AuthContext';
import { getHeldMicrophoneStream } from '../services/microphoneAccess';
import {
  primeMicrophoneForWake,
  startWakePhraseListening,
  stopWakePhraseListening,
  type WakePhraseListenerOptions,
} from '../services/rubyWakeListening';
import {
  RUBY_WAKE_LEGACY_PREF_KEY,
  RUBY_OPEN_EVENT,
  RUBY_WAKE_DEFAULT_ENABLED,
  RUBY_WAKE_PREF_CHANGED_EVENT,
  RUBY_WAKE_PREF_KEY,
  RUBY_WAKE_TRIGGER_COOLDOWN_MS,
} from '../constants/rubyWake';

export interface RubyVoiceContextValue {
  open: boolean;
  closing: boolean;
  phase: AssistantPhase;
  rubyWakeEnabled: boolean;
  openVoiceAssistant: () => void;
  closeVoiceAssistant: () => void;
  setRubyListeningEnabled: (enabled: boolean) => void;
  toggleRubyListening: () => void;
}

const RubyVoiceContext = createContext<RubyVoiceContextValue | undefined>(undefined);

function readRubyWakeEnabled(): boolean {
  const raw = localStorage.getItem(RUBY_WAKE_PREF_KEY);
  if (raw != null) return raw === 'true';
  const legacyRaw = localStorage.getItem(RUBY_WAKE_LEGACY_PREF_KEY);
  if (legacyRaw != null) {
    localStorage.setItem(RUBY_WAKE_PREF_KEY, legacyRaw);
  }
  return legacyRaw == null ? RUBY_WAKE_DEFAULT_ENABLED : legacyRaw === 'true';
}

const RubyVoiceProviderInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [presentToast] = useIonToast();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<AssistantPhase>('idle');
  const [closing, setClosing] = useState(false);
  const [rubyWakeEnabled, setRubyWakeEnabled] = useState<boolean>(() => readRubyWakeEnabled());

  const wakeListenerRunningRef = useRef(false);
  const wakeOptionsRef = useRef<WakePhraseListenerOptions | null>(null);
  const lastWakeTriggerAtRef = useRef(0);
  const wakeToastShownRef = useRef(false);
  const wakeMicUnavailableRef = useRef(false);
  const appStateListenerRef = useRef<PluginListenerHandle | null>(null);
  const voiceOpenRef = useRef(false);
  const voiceClosingRef = useRef(false);

  voiceOpenRef.current = open;
  voiceClosingRef.current = closing;

  const isPageVisible = useCallback(() => {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible';
  }, []);

  useEffect(() => {
    if (!open) {
      setPhase('idle');
      setClosing(false);
    }
  }, [open]);

  const openVoiceAssistant = useCallback(() => {
    if (!rubyWakeEnabled || open || closing || !isPageVisible()) return;
    setOpen(true);
  }, [closing, isPageVisible, open, rubyWakeEnabled]);

  const closeVoiceAssistant = useCallback(() => {
    setOpen(false);
  }, []);

  const setRubyListeningEnabled = useCallback((nextEnabled: boolean) => {
    setRubyWakeEnabled(nextEnabled);
    try {
      localStorage.setItem(RUBY_WAKE_PREF_KEY, String(nextEnabled));
      window.dispatchEvent(new Event(RUBY_WAKE_PREF_CHANGED_EVENT));
    } catch {
      /* localStorage unavailable — state still updates for this session */
    }

    if (!nextEnabled) {
      wakeListenerRunningRef.current = false;
      wakeMicUnavailableRef.current = false;
      wakeToastShownRef.current = false;
      setPhase('idle');
      setClosing(false);
      setOpen(false);
      void stopWakePhraseListening();
      return;
    }

    wakeMicUnavailableRef.current = false;
    wakeToastShownRef.current = false;
  }, []);

  const toggleRubyListening = useCallback(() => {
    setRubyListeningEnabled(!rubyWakeEnabled);
  }, [rubyWakeEnabled, setRubyListeningEnabled]);

  const openVoiceAssistantFromWake = useCallback(() => {
    if (!rubyWakeEnabled || open || closing || !isPageVisible()) {
      console.log('[ruby-wake] wake ignored: disabled/open/closing/hidden');
      return;
    }
    const now = Date.now();
    if (now - lastWakeTriggerAtRef.current < RUBY_WAKE_TRIGGER_COOLDOWN_MS) {
      console.log('[ruby-wake] wake ignored: cooldown');
      return;
    }
    lastWakeTriggerAtRef.current = now;
    console.log('[ruby-wake] wake detected');
    // Wake pipeline already stopped in rubyWakeListening; clear ref so we can restart after session.
    wakeListenerRunningRef.current = false;
    openVoiceAssistant();
  }, [closing, isPageVisible, open, openVoiceAssistant, rubyWakeEnabled]);

  useEffect(() => {
    const onOpen = () => openVoiceAssistant();
    window.addEventListener(RUBY_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(RUBY_OPEN_EVENT, onOpen);
  }, [openVoiceAssistant]);

  useEffect(() => {
    const onWakePrefChanged = () => setRubyWakeEnabled(readRubyWakeEnabled());
    const onStorage = (event: StorageEvent) => {
      if (event.key !== RUBY_WAKE_PREF_KEY) return;
      setRubyWakeEnabled(readRubyWakeEnabled());
    };
    window.addEventListener(RUBY_WAKE_PREF_CHANGED_EVENT, onWakePrefChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(RUBY_WAKE_PREF_CHANGED_EVENT, onWakePrefChanged);
    };
  }, []);

  useEffect(() => {
    wakeOptionsRef.current = {
      onWakeDetected: () => {
        openVoiceAssistantFromWake();
      },
      onPermissionDenied: () => {
        if (wakeToastShownRef.current) return;
        wakeToastShownRef.current = true;
        void presentToast({
          message:
            'Hey Ruby needs microphone access. Tap anywhere in the app once, or enable Microphone for UniFlow in Settings.',
          duration: 4000,
          position: 'top',
          color: 'warning',
        });
      },
      onStartFailed: (message, micNotFound) => {
        if (micNotFound) {
          wakeMicUnavailableRef.current = true;
        }
        if (wakeToastShownRef.current) return;
        wakeToastShownRef.current = true;
        void presentToast({
          message: micNotFound ? message : `Hey Ruby could not start: ${message}`,
          duration: 5000,
          position: 'top',
          color: 'warning',
        });
      },
      onDebugEvent: (message) => {
        console.log(`[ruby-wake] ${message}`);
      },
    };
    return () => {
      void stopWakePhraseListening();
      wakeListenerRunningRef.current = false;
      wakeOptionsRef.current = null;
    };
  }, [openVoiceAssistantFromWake, presentToast]);

  useEffect(() => {
    const stopListening = async () => {
      wakeListenerRunningRef.current = false;
      await stopWakePhraseListening();
    };

    const startIfAllowed = async () => {
      const options = wakeOptionsRef.current;
      if (!options || !rubyWakeEnabled || voiceOpenRef.current || voiceClosingRef.current || !isPageVisible()) {
        return;
      }
      if (wakeListenerRunningRef.current) {
        return;
      }
      if (wakeMicUnavailableRef.current) {
        return;
      }
      if (Capacitor.isNativePlatform() && !getHeldMicrophoneStream()) {
        return;
      }
      wakeToastShownRef.current = false;
      const ok = await startWakePhraseListening(options);
      wakeListenerRunningRef.current = ok;
    };

    const restartWakeAfterSession = async () => {
      await stopListening();
      if (!rubyWakeEnabled || !isPageVisible() || voiceOpenRef.current || voiceClosingRef.current) {
        return;
      }
      if (Capacitor.isNativePlatform()) {
        const primed = await primeMicrophoneForWake();
        if (!primed) {
          console.log('[ruby-wake] mic re-prime skipped after Ruby session');
          return;
        }
      }
      await startIfAllowed();
    };

    const primeMicFromGesture = () => {
      if (voiceOpenRef.current) return;
      wakeMicUnavailableRef.current = false;
      wakeToastShownRef.current = false;
      if (getHeldMicrophoneStream()) {
        void startIfAllowed();
        return;
      }
      void primeMicrophoneForWake().then((started) => {
        if (!started) return;
        void startIfAllowed();
      });
    };

    const onVisibility = () => {
      if (!isPageVisible()) {
        void stopListening();
        return;
      }
      if (voiceOpenRef.current || voiceClosingRef.current) return;
      void restartWakeAfterSession();
    };

    const init = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          appStateListenerRef.current = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) {
              void stopListening();
              return;
            }
            if (voiceOpenRef.current || voiceClosingRef.current) return;
            void restartWakeAfterSession();
          });
        } catch {
          /* noop */
        }
      }
      if (!voiceOpenRef.current && !voiceClosingRef.current) {
        void startIfAllowed();
      }
    };

    void init();
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('pointerdown', primeMicFromGesture, { capture: true, passive: true });
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerdown', primeMicFromGesture, { capture: true });
      void stopListening();
      void appStateListenerRef.current?.remove().catch(() => undefined);
      appStateListenerRef.current = null;
    };
  }, [isPageVisible, rubyWakeEnabled]);

  // Pause wake while Ruby voice is open; restart Hey Ruby after overlay fully closes.
  useEffect(() => {
    if (open) {
      wakeListenerRunningRef.current = false;
      void stopWakePhraseListening();
      return;
    }
    if (closing) {
      return;
    }
    void (async () => {
      await stopWakePhraseListening();
      wakeListenerRunningRef.current = false;
      if (!rubyWakeEnabled || !isPageVisible()) return;
      if (Capacitor.isNativePlatform()) {
        const primed = await primeMicrophoneForWake();
        if (!primed) return;
      }
      const options = wakeOptionsRef.current;
      if (!options) return;
      const ok = await startWakePhraseListening(options);
      wakeListenerRunningRef.current = ok;
      if (ok) {
        console.log('[ruby-wake] wake_listener_restarted after Ruby session');
      }
    })();
  }, [open, closing, isPageVisible, rubyWakeEnabled]);

  const value = useMemo<RubyVoiceContextValue>(
    () => ({
      open,
      closing,
      phase,
      rubyWakeEnabled,
      openVoiceAssistant,
      closeVoiceAssistant,
      setRubyListeningEnabled,
      toggleRubyListening,
    }),
    [
      open,
      closing,
      phase,
      rubyWakeEnabled,
      openVoiceAssistant,
      closeVoiceAssistant,
      setRubyListeningEnabled,
      toggleRubyListening,
    ]
  );

  return (
    <RubyVoiceContext.Provider value={value}>
      {children}
      <VoiceAssistantOverlay
        open={open}
        onClose={closeVoiceAssistant}
        onPhaseChange={setPhase}
        onClosingChange={setClosing}
      />
    </RubyVoiceContext.Provider>
  );
};

/** Global Ruby voice + Hey Ruby wake listener — active only when signed in. */
export const RubyVoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <>{children}</>;
  }

  return <RubyVoiceProviderInner>{children}</RubyVoiceProviderInner>;
};

export function useRubyVoice(): RubyVoiceContextValue {
  const ctx = useContext(RubyVoiceContext);
  if (!ctx) {
    return {
      open: false,
      closing: false,
      phase: 'idle',
      rubyWakeEnabled: readRubyWakeEnabled(),
      openVoiceAssistant: () => {
        window.dispatchEvent(new Event(RUBY_OPEN_EVENT));
      },
      closeVoiceAssistant: () => undefined,
      setRubyListeningEnabled: () => undefined,
      toggleRubyListening: () => undefined,
    };
  }
  return ctx;
}

/** Open Ruby from anywhere (pages without BottomNavigation, buttons, etc.). */
export function openRubyVoiceAssistant(): void {
  window.dispatchEvent(new Event(RUBY_OPEN_EVENT));
}
