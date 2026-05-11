import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIonRouter } from '@ionic/react';
import { useHistory, useLocation } from 'react-router-dom';
import { useLongPress } from '../hooks/useLongPress';
import VoiceAssistantOverlay, { type AssistantPhase } from './voice-assistant/VoiceAssistantOverlay';
import './BottomNavigation.css';

interface BottomNavigationProps {
  voiceOnboardingActive?: boolean;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ voiceOnboardingActive = false }) => {
  const ionRouter = useIonRouter();
  const history = useHistory();
  const location = useLocation();
  const [voiceAssistantOpen, setVoiceAssistantOpen] = useState(false);
  const [voicePhase, setVoicePhase] = useState<AssistantPhase>('idle');
  const [voiceClosing, setVoiceClosing] = useState(false);
  const centralChatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!voiceAssistantOpen) {
      setVoicePhase('idle');
      setVoiceClosing(false);
    }
  }, [voiceAssistantOpen]);

  /** Root tabs: replace Ionic stack so a previous /course/:id page cannot stay visible under a highlighted tab. */
  const navigateToMainTab = useCallback(
    (path: string) => {
      const focusedElement = document.activeElement as HTMLElement;
      focusedElement?.blur();

      try {
        ionRouter.push(path, 'root', 'replace');
      } catch (error) {
        console.error('IonRouter navigation failed, falling back to history.replace:', error);
        try {
          history.replace(path);
        } catch (e) {
          console.error('history.replace failed:', e);
          window.location.href = path;
        }
      }
    },
    [history, ionRouter],
  );

  const navigateForward = useCallback(
    (path: string) => {
      const focusedElement = document.activeElement as HTMLElement;
      focusedElement?.blur();

      try {
        ionRouter.push(path, 'forward', 'push');
      } catch (error) {
        console.error('IonRouter forward navigation failed, falling back to history.push:', error);
        try {
          history.push(path);
        } catch (e) {
          console.error('history.push failed:', e);
          window.location.href = path;
        }
      }
    },
    [history, ionRouter],
  );

  const openVoiceAssistant = useCallback(() => {
    setVoiceAssistantOpen(true);
    requestAnimationFrame(() => {
      centralChatRef.current?.blur();
    });
  }, []);

  const closeVoiceAssistant = useCallback(() => {
    setVoiceAssistantOpen(false);
  }, []);

  const navigateChatbot = useCallback(() => {
    navigateForward('/chatbot');
    requestAnimationFrame(() => {
      centralChatRef.current?.blur();
    });
  }, [navigateForward]);

  const chatbotLongPress = useLongPress({
    onLongPress: openVoiceAssistant,
    onShortPress: navigateChatbot,
    durationMs: 750,
    moveThresholdPx: 12
  });

  const isActive = (path: string) => {
    const { pathname } = location;
    if (path === '/courses') {
      return pathname === '/courses' || pathname.startsWith('/course/') || pathname.startsWith('/note/');
    }
    if (path === '/plans') {
      return pathname === '/plans' || pathname.startsWith('/plans/');
    }
    return pathname === path;
  };

  return (
    <div className={`bottom-nav ${voiceAssistantOpen ? 'bottom-nav--voice-mode' : ''}`}>
      <VoiceAssistantOverlay
        open={voiceAssistantOpen}
        onClose={closeVoiceAssistant}
        onPhaseChange={setVoicePhase}
        onClosingChange={setVoiceClosing}
      />

      {/* Home */}
      <div
        className={`nav-item ${isActive('/home') ? 'active' : ''}`}
        onClick={() => navigateToMainTab('/home')}
      >
        <div className="nav-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </div>
        <span>Home</span>
      </div>

      {/* Plans */}
      <div
        className={`nav-item ${isActive('/plans') ? 'active' : ''}`}
        onClick={() => navigateToMainTab('/plans')}
      >
        <div className="nav-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm8 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM5 19V9h14v10H5z" />
            <rect x="7" y="11" width="10" height="1.5" rx="0.75" />
            <rect x="7" y="14" width="7" height="1.5" rx="0.75" />
          </svg>
        </div>
        <span>Plans</span>
      </div>

      {/* Central chatbot button — tap: chatbot, long-press ~0.75s: voice overlay */}
      <div className="central-button-wrapper">
        <img
          src="/assets/icons/icons2/Subtract_icon.svg"
          alt="Nav Cutout"
          className="navbar-cutout"
        />
        <div
          ref={centralChatRef}
          className={[
            'nav-item central',
            voiceOnboardingActive && 'voice-onboarding-highlight',
            voiceAssistantOpen && 'voice-hub--active',
            voiceAssistantOpen && `voice-hub--phase-${voicePhase}`,
            voiceAssistantOpen && voiceClosing && 'voice-hub--closing'
          ]
            .filter(Boolean)
            .join(' ')}
          role="button"
          tabIndex={0}
          aria-label="Chatbot. Hold for voice assistant."
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigateChatbot();
            }
          }}
          {...chatbotLongPress}
        >
          <div className="nav-icon">
            {voiceAssistantOpen && !voiceClosing && (
              <div className="voice-hub-orbits" aria-hidden>
                <span className="voice-hub-orbit voice-hub-orbit--a" />
                <span className="voice-hub-orbit voice-hub-orbit--b" />
                <span className="voice-hub-orbit voice-hub-orbit--c" />
              </div>
            )}
            <img
              src="/assets/icons/icons2/chabot_icon.svg"
              alt="Chatbot"
              style={{ width: '28px', height: '28px' }}
            />
          </div>
        </div>
      </div>

      {/* Courses */}
      <div
        className={`nav-item ${isActive('/courses') ? 'active' : ''}`}
        onClick={() => navigateToMainTab('/courses')}
      >
        <div className="nav-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 2.18L20.32 9 12 13.28 3.68 9 12 5.18zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
          </svg>
        </div>
        <span>Courses</span>
      </div>

      {/* Settings */}
      <div
        className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
        onClick={() => navigateToMainTab('/settings')}
      >
        <div className="nav-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.01 7.01 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54a7.34 7.34 0 0 0-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.36 1.04.67 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54a7.34 7.34 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 0 1 8.4 12 3.6 3.6 0 0 1 12 8.4 3.6 3.6 0 0 1 15.6 12 3.6 3.6 0 0 1 12 15.6z" />
          </svg>
        </div>
        <span>Settings</span>
      </div>
    </div>
  );
};

export default BottomNavigation;
