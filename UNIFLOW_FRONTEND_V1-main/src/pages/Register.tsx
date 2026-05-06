import { IonContent, IonPage, IonToast, IonInput, IonButton, IonItem, IonLabel } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Register.css';
import BackButton from '../components/BackButton';
import { getDefaultStartPath } from '../utils/appPreferences';

const Register: React.FC = () => {
  const history = useHistory();
  const { register, error, clearError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger'>('success');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRegister = async () => {
    // Basic validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setToastMessage('Please fill in all fields');
      setToastColor('danger');
      setShowToast(true);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setToastMessage('Passwords do not match');
      setToastColor('danger');
      setShowToast(true);
      return;
    }

    if (formData.password.length < 6) {
      setToastMessage('Password must be at least 6 characters long');
      setToastColor('danger');
      setShowToast(true);
      return;
    }

    try {
      setLoading(true);
      clearError();
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password
      });
      setToastMessage('Registration successful!');
      setToastColor('success');
      setShowToast(true);
      
      // Immediate redirect - no delay needed
      history.push(getDefaultStartPath());
    } catch (error: any) {
      setToastMessage(error.message || 'Registration failed. Please try again.');
      setToastColor('danger');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSignUp = () => {
    history.push('/signup');
  };

  const handleGoToLogin = () => {
    history.push('/login');
  };

  return (
    <IonPage>
      <IonContent fullscreen className="register-screen">
        {/* Background Video */}
        <div className="register-background">
          <video 
            src="/assets/signup-bg.mp4" 
            className="register-bg-video"
            autoPlay
            muted
            loop
            playsInline
          />
        </div>

        {/* Back Button */}
        <BackButton to="/signup" />

        {/* Register Card */}
        <div className="register-card">
          <h1 className="register-title">Create Account</h1>
          
          {/* Register Form */}
          <div className="register-form">
                         <IonItem className="register-input-item">
               <IonInput
                 type="text"
                 value={formData.name}
                 onIonChange={(e) => handleInputChange('name', e.detail.value || '')}
                 placeholder="Full Name"
                 className="register-input"
               />
             </IonItem>

                         <IonItem className="register-input-item">
               <IonInput
                 type="email"
                 value={formData.email}
                 onIonChange={(e) => handleInputChange('email', e.detail.value || '')}
                 placeholder="Email"
                 className="register-input"
               />
             </IonItem>

            <IonItem className="register-input-item">
              <IonInput
                type="password"
                value={formData.password}
                onIonChange={(e) => handleInputChange('password', e.detail.value || '')}
                placeholder="Password"
                className="register-input"
              />
            </IonItem>

                         <IonItem className="register-input-item">
               <IonInput
                 type="password"
                 value={formData.confirmPassword}
                 onIonChange={(e) => handleInputChange('confirmPassword', e.detail.value || '')}
                 placeholder="Confirm Password"
                 className="register-input"
               />
             </IonItem>

            <IonButton
              expand="block"
              className="register-submit-button"
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
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
        <div className="register-legal-text">
          Already have an account?{' '}
          <button className="register-legal-link" onClick={handleGoToLogin}>
            Sign in
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Register;

