import { IonContent, IonPage } from '@ionic/react';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../api/client';
import { getDefaultStartPath } from '../utils/appPreferences';

const GoogleCallback: React.FC = () => {
  const history = useHistory();
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState('Completing sign in...');
  
  console.log('GoogleCallback component rendered');

  useEffect(() => {
    console.log('GoogleCallback useEffect triggered');
    const handleGoogleCallback = async () => {
      try {
        console.log('Current URL:', window.location.href);
        const url = new URL(window.location.href);
        const token = url.searchParams.get('token');
        const userParam = url.searchParams.get('user');
        const error = url.searchParams.get('error');
        const origin = url.searchParams.get('origin');
        
        console.log('URL params:', { token: !!token, userParam: !!userParam, error, origin });
        
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
          
          // Clear any existing authentication first
          console.log('Google OAuth: Clearing existing auth before setting new session');
          localStorage.removeItem('uniflow_token');
          localStorage.removeItem('uniflow_user');
          localStorage.removeItem('refreshToken');
          
          localStorage.setItem('uniflow_token', token);
          
          // Parse user data from URL (no extra API call needed!)
          setStatus('Loading profile...');
          const userData = JSON.parse(decodeURIComponent(userParam));
          
          console.log('Google OAuth raw user data:', userData);
          console.log('Google OAuth user data type:', typeof userData);
          console.log('Google OAuth user data keys:', Object.keys(userData));
          
          // Store user data in localStorage for AuthContext
          localStorage.setItem('uniflow_user', JSON.stringify(userData));
          
          console.log('Google OAuth: User data stored in localStorage');
          console.log('Google OAuth: Token stored:', !!token);
          setStatus('Success! Redirecting...');
          
          // Force refresh the user in AuthContext to ensure immediate authentication
          try {
            await refreshUser();
            console.log('Google OAuth: User refreshed in AuthContext');
          } catch (error) {
            console.log('Google OAuth: refreshUser failed, but localStorage is set:', error);
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
  }, [history]);

  console.log('GoogleCallback rendering with status:', status);
  
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
          <div style={{ fontSize: '14px', color: '#666' }}>Debug: Component is rendering</div>
          {status.includes('Loading') && (
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