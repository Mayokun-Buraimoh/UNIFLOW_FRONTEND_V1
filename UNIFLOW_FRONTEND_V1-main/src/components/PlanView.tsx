import React from 'react';
import { IonPage, IonContent, IonIcon } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { arrowBack } from 'ionicons/icons';
import './PlanView.css';

interface PlanViewProps {
  plan: {
    title: string;
    icon?: string;
    backgroundImage?: string;
    progress?: number;
    type?: string;
  };
  onClose?: () => void;
}

const PlanView: React.FC<PlanViewProps> = ({ plan, onClose }) => {
  const history = useHistory();

  return (
    <IonPage>
      <IonContent scrollY={false}>
        <div className="plan-view-screen">
          {/* Status Bar Spacer */}
          <div className="status-bar-spacer"></div>
          
          {/* Header */}
          <div className="plan-header">
            <button className="back-button" onClick={() => onClose ? onClose() : history.goBack()}>
              <IonIcon icon={arrowBack} />
            </button>
            <h1 className="plan-title">{plan.title}</h1>
          </div>

          {/* Blank Content Area */}
          <div className="blank-content">
            {/* Empty - just a blank page */}
          </div>
        </div>
        
        {/* Fixed Bottom Spacer */}
        <div className="fixed-bottom-spacer"></div>
      </IonContent>
    </IonPage>
  );
};

export default PlanView;
