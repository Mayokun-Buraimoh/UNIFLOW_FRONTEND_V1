import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { playListeningCue, triggerActivationHaptic } from '../../utils/voiceAssistantCue';
import { useAuth } from '../../contexts/AuthContext';
import { useRubyVoiceSession } from '../../hooks/useRubyVoiceSession';
import './VoiceAssistantOverlay.css';

export type AssistantPhase = 'idle' | 'listening' | 'processing' | 'responding';

interface VoiceAssistantOverlayProps {
  open: boolean;
  onClose: () => void;
  onPhaseChange?: (phase: AssistantPhase) => void;
  onClosingChange?: (closing: boolean) => void;
}

const VoiceAssistantOverlay: React.FC<VoiceAssistantOverlayProps> = ({
  open: openProp,
  onClose,
  onPhaseChange,
  onClosingChange
}) => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const { phase: rubyPhase, transcript, assistantMessage, error } = useRubyVoiceSession({
    open: !!openProp && !closing,
    userId: user?.id,
    onPhaseForNav: onPhaseChange
  });

  useEffect(() => {
    onClosingChange?.(closing);
  }, [closing, onClosingChange]);

  const runClose = useCallback(() => {
    setClosing(true);
  }, []);

  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (e.propertyName !== 'opacity' || !closing) return;
      setVisible(false);
      setClosing(false);
      onClose();
    },
    [closing, onClose]
  );

  useEffect(() => {
    if (!openProp) {
      setVisible(false);
      setClosing(false);
      return;
    }

    setVisible(true);
    setClosing(false);
    void triggerActivationHaptic();
    playListeningCue();
  }, [openProp]);

  const requestClose = useCallback(() => {
    if (closing) return;
    runClose();
  }, [closing, runClose]);

  const onBackdropPointerDown = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) {
      requestClose();
    }
  };

  if (!visible) {
    return null;
  }

  const hasError = !!error || rubyPhase === 'error';
  const normalizedTranscript = transcript.trim().toLowerCase();
  const normalizedAssistantMessage = assistantMessage.trim().toLowerCase();
  const visibleAssistantMessage =
    assistantMessage && normalizedAssistantMessage !== normalizedTranscript ? assistantMessage : '';
  const statusHint =
    rubyPhase === 'greeting_playing'
      ? 'Ruby is introducing herself'
      : rubyPhase === 'listening'
        ? 'Listening...'
        : rubyPhase === 'uploading'
          ? 'Sending...'
          : rubyPhase === 'thinking'
            ? 'Thinking...'
            : rubyPhase === 'speaking'
              ? 'Speaking...'
              : null;

  const isWorkingPhase =
    !hasError &&
    (rubyPhase === 'uploading' ||
      rubyPhase === 'thinking' ||
      rubyPhase === 'speaking' ||
      rubyPhase === 'greeting_playing');

  const showVoicePill = !hasError;

  return createPortal(
    <div
      className={`voice-assistant-root ${closing ? 'voice-assistant-root--closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Ruby voice assistant"
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
        className={`voice-assistant-dock ${showVoicePill ? 'voice-assistant-dock--bubble' : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="voice-assistant-transcript" aria-live="polite">
          {hasError && (
            <p className="voice-assistant-hint voice-assistant-hint--warn">
              {error || 'Something went wrong. Close and try again.'}
            </p>
          )}

          {(!hasError && rubyPhase === 'listening') ||
          (isWorkingPhase && (rubyPhase === 'uploading' || rubyPhase === 'thinking' || !visibleAssistantMessage)) ? (
            <p
              className="voice-assistant-hint voice-assistant-status"
              role="status"
              aria-live="polite"
            >
              <span className="voice-assistant-status-label">{statusHint}</span>
              <span className="voice-assistant-status-dots" aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </p>
          ) : null}

          {visibleAssistantMessage ? <p className="voice-assistant-response">{visibleAssistantMessage}</p> : null}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VoiceAssistantOverlay;
