import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useEffect } from 'react';
import './Onboarding.css';
import './Onboarding2.page.css';

const Onboarding2: React.FC = () => {
  const history = useHistory();

  // Fix focus management on component mount
  useEffect(() => {
    // Remove any existing focus to prevent ARIA conflicts
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const handleNext = () => {
    localStorage.setItem('uniflow_onboarding_completed', 'true');
    // Remove focus before navigation
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    history.push('/signup');
  };

  const handleSkip = () => {
    localStorage.setItem('uniflow_onboarding_completed', 'true');
    // Remove focus before navigation
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    history.push('/signup');
  };

  return (
    <IonPage className="onboarding-page">
      <IonContent fullscreen className="onboarding-screen">
        <div className="onboarding-layout">
          <div className="image-section">
            <div className="circular-image">
              <img
                src="/assets/onboarding2.jpg"
                alt="Woman with sticky notes managing deadlines"
                className="onboarding-image"
              />
            </div>
          </div>

          <div className="content-card">
            <div className="card-content">
              <div className="card-copy">
                <h1 className="card-title">
                  Never Miss a Deadline
                  <br />
                  Again
                </h1>
                <p className="card-subtitle">Easily manage your assignments, reminders, and to-dos — all in one place.</p>
              </div>

              <div className="card-footer">
                <div className="action-buttons">
                  <button type="button" className="skip-button" onClick={handleSkip}>Skip</button>
                  <button type="button" className="next-button" onClick={handleNext}>Next</button>
                </div>
                <div className="pagination-dots">
                  <div className="dot"></div>
                  <div className="dot active"></div>
                  <div className="dot"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Onboarding2;




