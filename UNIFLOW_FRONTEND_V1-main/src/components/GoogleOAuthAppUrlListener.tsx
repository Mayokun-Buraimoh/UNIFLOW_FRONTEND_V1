import { useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultStartPath } from '../utils/appPreferences';
import {
  completeGoogleOAuthSignIn,
  getOAuthUrlDedupeKey,
  isGoogleOAuthReturnUrl,
  wasOAuthUrlProcessed,
} from '../utils/googleOAuth';

/**
 * TestFlight / iOS: backend redirects to com.googleusercontent.apps…:/oauthredirect?token=…
 * WebView route `/auth/google/callback` never runs — handle via appUrlOpen.
 */
const GoogleOAuthAppUrlListener: React.FC = () => {
  const history = useHistory();
  const { applySessionFromStorage } = useAuth();
  const historyRef = useRef(history);
  const applySessionRef = useRef(applySessionFromStorage);
  const handlingRef = useRef(false);

  historyRef.current = history;
  applySessionRef.current = applySessionFromStorage;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    const handleUrl = async (url: string) => {
      if (cancelled || !isGoogleOAuthReturnUrl(url)) return;

      const dedupeKey = getOAuthUrlDedupeKey(url);
      if (dedupeKey && wasOAuthUrlProcessed(dedupeKey)) return;
      if (handlingRef.current) return;

      handlingRef.current = true;
      try {
        const result = await completeGoogleOAuthSignIn(url, undefined, {
          skipApiRefresh: true,
        });
        if (cancelled) return;

        if (result.ok) {
          applySessionRef.current();
          historyRef.current.replace(getDefaultStartPath());
          return;
        }
        historyRef.current.replace(result.redirectTo);
      } finally {
        handlingRef.current = false;
      }
    };

    const launchSub = CapApp.addListener('appUrlOpen', ({ url }) => {
      void handleUrl(url);
    });

    void CapApp.getLaunchUrl().then((launch) => {
      if (launch?.url) void handleUrl(launch.url);
    });

    return () => {
      cancelled = true;
      void launchSub.then((h) => h.remove());
    };
  }, []);

  return null;
};

export default GoogleOAuthAppUrlListener;
