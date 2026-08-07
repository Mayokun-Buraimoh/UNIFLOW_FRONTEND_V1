import { IonContent, IonPage, IonToast, IonInput, IonButton, IonItem, IonLabel } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';
import BackButton from '../components/BackButton';
import { getDefaultStartPath } from '../utils/appPreferences';

const Login: React.FC = () => {
  const history = useHistory();
  const { login, error, clearError, isAuthenticated, loading: authLoading, adminBypass } = useAuth();

  // If the user is already signed in (e.g. landed here via browser back / swipe-back
  // after the auth route was left in the history stack), bounce them to home so the
  // sign-in screen can never get "stuck" behind authenticated tabs like Courses/Plans.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      history.replace(getDefaultStartPath());
    }
  }, [authLoading, isAuthenticated, history]);
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

      // Replace (not push) so /login is removed from the history stack. Otherwise the
      // bottom-nav 'replace' action on Courses/Plans leaves /login underneath and
      // back/swipe-back lands the user on the sign-in screen.
      history.replace(getDefaultStartPath());
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
                onIonInput={(e) => handleInputChange('email', e.detail.value ?? '')}
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
                onIonInput={(e) => handleInputChange('password', e.detail.value ?? '')}
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
