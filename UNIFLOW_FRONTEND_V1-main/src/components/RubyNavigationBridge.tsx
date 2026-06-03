import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useIonRouter } from '@ionic/react';
import { RUBY_NAVIGATE_EVENT, type RubyNavigateDetail } from '../constants/rubyNavigate';

/**
 * Listens for Ruby voice navigation intents anywhere inside IonReactRouter.
 * RubyVoiceProvider handles voice + wake globally; this bridge handles routing.
 */
export default function RubyNavigationBridge() {
  const ionRouter = useIonRouter();
  const history = useHistory();

  useEffect(() => {
    const onRubyNavigate = (event: Event) => {
      const detail = (event as CustomEvent<RubyNavigateDetail>).detail;
      if (!detail?.path) return;

      const focusedElement = document.activeElement as HTMLElement | null;
      focusedElement?.blur();

      if (detail.mode === 'forward') {
        try {
          ionRouter.push(detail.path, 'forward', 'push');
        } catch {
          try {
            history.push(detail.path);
          } catch {
            window.location.href = detail.path;
          }
        }
        return;
      }

      try {
        ionRouter.push(detail.path, 'root', 'replace');
      } catch {
        try {
          history.replace(detail.path);
        } catch {
          window.location.href = detail.path;
        }
      }
    };

    window.addEventListener(RUBY_NAVIGATE_EVENT, onRubyNavigate);
    return () => window.removeEventListener(RUBY_NAVIGATE_EVENT, onRubyNavigate);
  }, [history, ionRouter]);

  return null;
}
