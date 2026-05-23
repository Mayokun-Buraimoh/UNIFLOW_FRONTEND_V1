import { IonContent, IonPage } from '@ionic/react';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultStartPath } from '../utils/appPreferences';
import { completeGoogleOAuthSignIn } from '../utils/googleOAuth';

const GoogleCallback: React.FC = () => {
  const history = useHistory();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState('Completing sign in...');

  useEffect(() => {
    const handleGoogleCallback = async () => {
      setStatus('Completing sign in...');
      const result = await completeGoogleOAuthSignIn(window.location.href, refreshUser);

      if (result.ok) {
        setStatus('Success! Redirecting...');
        setTimeout(() => history.replace(getDefaultStartPath()), 200);
        return;
      }

      if (result.reason === 'cancelled') {
        setStatus('Sign-in cancelled. Redirecting...');
        setTimeout(() => history.replace(result.redirectTo), 1500);
        return;
      }

      setStatus('Authentication failed. Redirecting...');
      setTimeout(() => history.replace(result.redirectTo), 2000);
    };

    void handleGoogleCallback();
  }, [history, refreshUser]);

  const showSpinner =
    status.toLowerCase().includes('loading') || status.toLowerCase().includes('completing');

  return (
    <IonPage>
      <IonContent fullscreen className="login-screen">
        <div
          style={{
            display: 'flex',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '20px',
            backgroundColor: '#f0f0f0',
            padding: '20px',
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>{status}</div>
          {showSpinner && <Spinner />}
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

function Spinner() {
  return (
    <div
      style={{
        width: '40px',
        height: '40px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #007bff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
  );
}

export default GoogleCallback;
