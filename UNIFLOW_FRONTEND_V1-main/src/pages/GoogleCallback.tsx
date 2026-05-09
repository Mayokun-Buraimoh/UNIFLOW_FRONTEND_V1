import { IonContent, IonPage } from '@ionic/react';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../api/client';
import { getDefaultStartPath } from '../utils/appPreferences';
import { clearUserScopedStorageIfUserChanged, readUserIdFromStorage } from '../utils/clearUserScopedStorage';

const GoogleCallback: React.FC = () => {
  const history = useHistory();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState('Completing sign in...');

  useEffect(() => {
    const handleGoogleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const token = url.searchParams.get('token');
        const userParam = url.searchParams.get('user');
        const error = url.searchParams.get('error');
        const origin = url.searchParams.get('origin');

        // Handle OAuth cancellation
        if (error === 'oauth_cancelled') {
          setStatus('Sign-in cancelled. Redirecting...');
          setTimeout(() => {
            // Redirect back to the origin page (signup by default)
            const redirectTo = origin === 'signup' ? '/signup' : '/login';
            history.replace(redirectTo);
          }, 1500);
          return;
        }
        
        if (token && userParam) {
          setStatus('Storing authentication...');
          
          const previousUserId = readUserIdFromStorage();
          // Clear any existing authentication first
          localStorage.removeItem('uniflow_token');
          localStorage.removeItem('uniflow_user');
          localStorage.removeItem('refreshToken');
          
          localStorage.setItem('uniflow_token', token);
          
          // Parse user data from URL (no extra API call needed!)
          setStatus('Loading profile...');
          const userData = JSON.parse(decodeURIComponent(userParam));
          clearUserScopedStorageIfUserChanged(previousUserId, userData.id);

          // Store user data in localStorage for AuthContext
          localStorage.setItem('uniflow_user', JSON.stringify(userData));

          setStatus('Success! Redirecting...');
          
          // Force refresh the user in AuthContext to ensure immediate authentication
          try {
            await refreshUser();
          } catch {
            // localStorage auth data is already written; continue redirect flow
          }
          
          // Redirect to home page
          setTimeout(() => {
            history.replace(getDefaultStartPath());
          }, 200);
        } else {
          setStatus('Authentication failed. Redirecting...');
          setTimeout(() => {
            // Redirect back to origin page if available, otherwise login
            const redirectTo = origin === 'signup' ? '/signup' : '/login';
            history.replace(redirectTo);
          }, 2000);
        }
      } catch (error) {
        console.error('Google callback error:', error);
        setStatus('Authentication failed. Redirecting...');
        setTimeout(() => {
          history.replace('/signup'); // Default to signup page on error
        }, 2000);
      }
    };

    handleGoogleCallback();
  }, [history, refreshUser]);
  
  return (
    <IonPage>
      <IonContent fullscreen className="login-screen">
        <div style={{ 
          display: 'flex', 
          height: '100%', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '20px',
          backgroundColor: '#f0f0f0',
          padding: '20px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>{status}</div>
          {status.toLowerCase().includes('loading') && (
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          )}
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

export default GoogleCallback;