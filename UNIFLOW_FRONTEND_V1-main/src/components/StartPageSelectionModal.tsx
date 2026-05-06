import React from 'react';
import './StartPageSelectionModal.css';

interface StartPageSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStartPage: (startPage: string) => void;
  currentStartPage: string;
}

const StartPageSelectionModal: React.FC<StartPageSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectStartPage,
  currentStartPage
}) => {
  const startPages = [
    'Home',
    'Plans',
    'Courses',
    'Weekly Schedule',
    'ChatBot'
  ];

  if (!isOpen) return null;

  return (
    <div className="start-page-modal-overlay" onClick={onClose}>
      <div className="start-page-modal" onClick={(e) => e.stopPropagation()}>
        <div className="start-page-modal-header">
          <h3 className="start-page-modal-title">Select Start Page</h3>
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
          </button>
        </div>
        
        <div className="start-page-options">
          {startPages.map((startPage) => (
            <div
              key={startPage}
              className={`start-page-option ${currentStartPage === startPage ? 'selected' : ''}`}
              onClick={() => {
                onSelectStartPage(startPage);
                onClose();
              }}
            >
              <span className="start-page-name">{startPage}</span>
              {currentStartPage === startPage && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#4CAF50">
                  <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StartPageSelectionModal;

