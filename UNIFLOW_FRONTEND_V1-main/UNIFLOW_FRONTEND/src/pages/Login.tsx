import { IonContent, IonPage, IonToast, IonInput, IonButton, IonItem, IonLabel } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';
import BackButton from '../components/BackButton';
import { getDefaultStartPath } from '../utils/appPreferences';

const Login: React.FC = () => {
  const history = useHistory();
  const { login, error, clearError, adminBypass } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger'>('success');
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [emailError, setEmailError] = useState('');

  // Email validation function
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Validate email format when email field changes
    if (field === 'email') {
      if (value && !validateEmail(value)) {
        setEmailError('Wrong email format');
      } else {
        setEmailError('');
      }
    }
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      setToastMessage('Please fill in all fields');
      setToastColor('danger');
      setShowToast(true);
      return;
    }

    // Check email format before login
    if (!validateEmail(formData.email)) {
      setToastMessage('Wrong email format');
      setToastColor('danger');
      setShowToast(true);
      return;
    }

    try {
      setLoading(true);
      clearError();
      await login(formData);
      setToastMessage('Login successful!');
      setToastColor('success');
      setShowToast(true);

      // Immediate redirect - no delay needed
      history.push(getDefaultStartPath());
    } catch (error: any) {
      setToastMessage(error.message || 'Login failed. Please try again.');
      setToastColor('danger');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSignUp = () => {
    history.push('/signup');
  };

  const handleGoToRegister = () => {
    history.push('/register');
  };

  return (
    <IonPage>
      <IonContent fullscreen className="login-screen">
        {/* Background Video */}
        <div className="login-background">
          <video
            src="/assets/signup-bg.mp4"
            className="login-bg-video"
            autoPlay
            muted
            loop
            playsInline
          />
        </div>

        {/* Back Button */}
        <BackButton to="/signup" />

        {/* Login Card */}
        <div className="login-card">
          <h1 className="login-title">Sign In</h1>

          {/* Login Form */}
          <div className="login-form">
            <IonItem className="login-input-item">
              <IonInput
                type="email"
                value={formData.email}
                onIonChange={(e) => handleInputChange('email', e.detail.value || '')}
                placeholder="Email"
                className="login-input"
              />
            </IonItem>

            {/* Email error message */}
            {emailError && (
              <div className="email-error-message">
                {emailError}
              </div>
            )}

            <IonItem className="login-input-item">
              <IonInput
                type="password"
                value={formData.password}
                onIonChange={(e) => handleInputChange('password', e.detail.value || '')}
                placeholder="Password"
                className="login-input"
              />
            </IonItem>

            <IonButton
              expand="block"
              className="login-submit-button"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </IonButton>

            {/* Admin Bypass Button */}
            <IonButton
              expand="block"
              className="login-admin-bypass-button"
              onClick={() => {
                adminBypass();
                setTimeout(() => {
                  history.push(getDefaultStartPath());
                }, 100);
              }}
              color="medium"
              style={{ marginTop: '10px' }}
            >
              Admin Bypass (No Backend)
            </IonButton>
          </div>

          {/* Toast for error messages */}
          <IonToast
            isOpen={showToast}
            onDidDismiss={() => setShowToast(false)}
            message={toastMessage}
            duration={3000}
            color={toastColor}
            position="top"
          />
        </div>

        {/* Legal Text */}
        <div className="login-legal-text">
          Don't have an account?{' '}
          <button className="login-legal-link" onClick={handleGoToRegister}>
            Sign up
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Login;
