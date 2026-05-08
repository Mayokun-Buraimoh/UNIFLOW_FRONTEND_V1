import React, { useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { IonContent, IonPage, IonSpinner } from '@ionic/react';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';
import { getDefaultStartPath } from '../utils/appPreferences';
import { clearUserScopedStorageIfUserChanged, readUserIdFromStorage } from '../utils/clearUserScopedStorage';

const Dashboard: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const handleOAuthCallback = () => {
      const urlParams = new URLSearchParams(location.search);
      const token = urlParams.get('token');
      const refreshToken = urlParams.get('refreshToken');
      const userStr = urlParams.get('user');

      if (token && refreshToken && userStr) {
        try {
          const previousUserId = readUserIdFromStorage();
          const userData = JSON.parse(userStr);
          clearUserScopedStorageIfUserChanged(previousUserId, userData.id);

          // Store tokens and user data
          localStorage.setItem('uniflow_token', token);
          localStorage.setItem('refreshToken', refreshToken);
          localStorage.setItem('uniflow_user', userStr);

          console.log('OAuth user data:', userData);

          console.log('OAuth callback successful, tokens stored');
          
          // Immediate redirect for faster performance
          history.replace(getDefaultStartPath());
        } catch (error) {
          console.error('Error processing OAuth callback:', error);
          history.replace('/login');
        }
      } else {
        // No OAuth parameters, just redirect to home
        console.log('No OAuth parameters found, redirecting to home');
        history.replace(getDefaultStartPath());
      }
    };

    handleOAuthCallback();
  }, [history, location]);

  return (
    <IonPage>
      <IonContent fullscreen className="dashboard-loading">
        <div className="loading-container">
          <IonSpinner name="crescent" />
          <p>Setting up your dashboard...</p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Dashboard;
