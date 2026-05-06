import { IonContent, IonPage } from '@ionic/react';
import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import './Splash.css';
import { cacheAppPreferencesFromProfile, getDefaultStartPath } from '../utils/appPreferences';

const Splash: React.FC = () => {
  const history = useHistory();

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const hasCompletedOnboarding = localStorage.getItem('uniflow_onboarding_completed') === 'true';
      const hasExistingSession = !!localStorage.getItem('uniflow_token') && !!localStorage.getItem('uniflow_user');

      if (!hasCompletedOnboarding) {
        history.replace('/onboarding');
        return;
      }

      if (!hasExistingSession) {
        history.replace('/signup');
        return;
      }

      try {
        const { profileService } = await import('../api/services');
        const profileData = await profileService.getProfile();
        cacheAppPreferencesFromProfile(
          profileData?.preferences as Record<string, unknown> | undefined
        );
      } catch {
        /* offline / stale token — use cached or default start path */
      }

      history.replace(getDefaultStartPath());
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [history]);

  return (
    <IonPage>
      <IonContent fullscreen className="splash-screen">
        {/* Main Logo */}
        <div className="logo-container">
          <div className="logo">
            <span className="uni">Uni</span>
            <span className="flow">Flow</span>
          </div>
          {/* Loading Circle */}
          <div className="loading-circle">
            <div className="spinner"></div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Splash;
