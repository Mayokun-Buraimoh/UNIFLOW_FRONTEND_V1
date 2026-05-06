import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SpeechRecognitionSession, isSpeechRecognitionSupported } from '../../services/SpeechService';
import { playListeningCue, triggerActivationHaptic } from '../../utils/voiceAssistantCue';
import './VoiceAssistantOverlay.css';

export type AssistantPhase = 'idle' | 'listening' | 'processing' | 'responding';

interface VoiceAssistantOverlayProps {
  open: boolean;
  onClose: () => void;
  onPhaseChange?: (phase: AssistantPhase) => void;
  onClosingChange?: (closing: boolean) => void;
}

const VoiceAssistantOverlay: React.FC<VoiceAssistantOverlayProps> = ({
  open,
  onClose,
  onPhaseChange,
  onClosingChange
}) => {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [phase, setPhase] = useState<AssistantPhase>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [typedFallback, setTypedFallback] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);

  const sessionRef = useRef<SpeechRecognitionSession | null>(null);
  const lastFinalRef = useRef('');
  const listeningRef = useRef(false);

  const speechSupported = typeof window !== 'undefined' && isSpeechRecognitionSupported();

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  useEffect(() => {
    onClosingChange?.(closing);
  }, [closing, onClosingChange]);

  const runClose = useCallback(() => {
    setClosing(true);
    listeningRef.current = false;
    sessionRef.current?.abort();
    sessionRef.current = null;
  }, []);

  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (e.propertyName !== 'opacity' || !closing) return;
      setVisible(false);
      setClosing(false);
      setPhase('idle');
      setTranscript('');
      setResponse('');
      setTypedFallback('');
      setSpeechError(null);
      lastFinalRef.current = '';
      onClose();
    },
    [closing, onClose]
  );

  useEffect(() => {
    if (!open) {
      listeningRef.current = false;
      sessionRef.current?.abort();
      sessionRef.current = null;
      setVisible(false);
      setClosing(false);
      setPhase('idle');
      setTranscript('');
      setResponse('');
      setTypedFallback('');
      setSpeechError(null);
      lastFinalRef.current = '';
      return;
    }

    setVisible(true);
    setClosing(false);
    setTranscript('');
    setResponse('');
    setTypedFallback('');
    setSpeechError(null);
    lastFinalRef.current = '';
    setPhase('listening');
    listeningRef.current = true;

    void triggerActivationHaptic();
    playListeningCue();

    const session = new SpeechRecognitionSession();
    sessionRef.current = session;

    if (!speechSupported) {
      setPhase('idle');
      setSpeechError('Voice typing isn’t available on this device. Type below instead.');
      listeningRef.current = false;
      return;
    }

    const started = session.start(
      (text, isFinal) => {
        if (!listeningRef.current) return;
        if (isFinal) {
          lastFinalRef.current = `${lastFinalRef.current} ${text}`.trim();
          setTranscript(lastFinalRef.current);
        } else {
          setTranscript(`${lastFinalRef.current} ${text}`.trim());
        }
      },
      (err) => {
        if (err === 'not-supported' || err === 'start-failed') {
          setSpeechError('Could not start microphone. You can type your message below.');
          setPhase('idle');
          listeningRef.current = false;
        }
      },
      () => {}
    );

    if (!started) {
      setPhase('idle');
      listeningRef.current = false;
    }

    return () => {
      listeningRef.current = false;
      session.abort();
      if (sessionRef.current === session) {
        sessionRef.current = null;
      }
    };
  }, [open, speechSupported]);

  const finalizeAndRespond = useCallback((text: string) => {
    const q = text.trim();
    if (!q) return;
    listeningRef.current = false;
    setPhase('processing');
    sessionRef.current?.stop();
    sessionRef.current = null;

    window.setTimeout(() => {
      setPhase('responding');
      setResponse(`Got it — “${q}”. Open the chat for a full conversation.`);
    }, 450);
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    runClose();
  }, [closing, runClose]);

  const onBackdropPointerDown = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) {
      requestClose();
    }
  };

  const submitTyped = () => {
    const t = typedFallback.trim() || transcript.trim();
    if (t) {
      setTranscript(t);
      finalizeAndRespond(t);
    }
  };

  const submitVoiceTranscript = () => {
    const t = transcript.trim();
    if (t) finalizeAndRespond(t);
  };

  if (!visible) {
    return null;
  }

  const showFallbackInput = !speechSupported || !!speechError;
  const showVoiceSend =
    speechSupported && !speechError && phase === 'listening' && transcript.trim().length > 0;
  const isListeningBubble = phase === 'listening' && !showFallbackInput && !response;

  return createPortal(
    <div
      className={`voice-assistant-root ${closing ? 'voice-assistant-root--closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Voice assistant"
      onTransitionEnd={handleTransitionEnd}
    >
      <button type="button" className="voice-assistant-close" onClick={requestClose}>
        Close
      </button>

      <div
        className="voice-assistant-backdrop"
        onPointerDown={onBackdropPointerDown}
        aria-hidden
      />

      <div
        className={`voice-assistant-dock ${isListeningBubble ? 'voice-assistant-dock--bubble' : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="voice-assistant-transcript" aria-live="polite">
          {speechError && <p className="voice-assistant-hint voice-assistant-hint--warn">{speechError}</p>}
          {transcript ? (
            <p className="voice-assistant-transcript-text">{transcript}</p>
          ) : phase === 'listening' && speechSupported && !speechError ? (
            <p className="voice-assistant-hint">Listening…</p>
          ) : null}
          {response ? <p className="voice-assistant-response">{response}</p> : null}
        </div>

        {showVoiceSend && (
          <button type="button" className="voice-assistant-send-voice" onClick={submitVoiceTranscript}>
            Send
          </button>
        )}

        {showFallbackInput && (
          <div className="voice-assistant-fallback">
            <label className="voice-assistant-fallback-label" htmlFor="voice-assistant-fallback-input">
              Message
            </label>
            <textarea
              id="voice-assistant-fallback-input"
              className="voice-assistant-fallback-input"
              rows={2}
              placeholder="Type what you’d like help with…"
              value={typedFallback}
              onChange={(e) => setTypedFallback(e.target.value)}
            />
            <button type="button" className="voice-assistant-fallback-send" onClick={submitTyped}>
              Send
            </button>
          </div>
        )}

        {phase === 'responding' && (
          <button type="button" className="voice-assistant-done" onClick={requestClose}>
            Done
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};

export default VoiceAssistantOverlay;
