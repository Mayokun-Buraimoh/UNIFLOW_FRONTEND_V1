import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import './Onboarding.css';

const Onboarding: React.FC = () => {
  const history = useHistory();

  const handleNext = () => {
    // Remove focus before navigation to prevent ARIA conflicts
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    history.push('/onboarding2');
  };

  const handleSkip = () => {
    localStorage.setItem('uniflow_onboarding_completed', 'true');
    // Remove focus before navigation to prevent ARIA conflicts
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    history.push('/signup');
  };

  return (
    <IonPage>
      <IonContent fullscreen className="onboarding-screen">
        <div className="onboarding-layout">
          <div className="image-section">
            <div className="circular-image">
              <img
                src="/assets/onboarding1.jpg"
                alt="Study group collaboration"
                className="onboarding-image"
              />
            </div>
          </div>

          <div className="content-card">
            <div className="card-content">
              <div className="card-copy">
                <h1 className="card-title">
                  Study Smarter,
                  <br />
                  Not Harder
                </h1>
                <p className="card-subtitle">Your all-in-one student productivity hub</p>
              </div>

              <div className="card-footer">
                <div className="action-buttons">
                  <button type="button" className="skip-button" onClick={handleSkip}>Skip</button>
                  <button type="button" className="next-button" onClick={handleNext}>Next</button>
                </div>
                <div className="pagination-dots">
                  <div className="dot active"></div>
                  <div className="dot"></div>
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

export default Onboarding;
