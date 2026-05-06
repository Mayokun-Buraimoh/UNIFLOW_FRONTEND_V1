import React from 'react';
import './LanguageSelectionModal.css';

interface LanguageSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLanguage: (language: string) => void;
  currentLanguage: string;
}

const LanguageSelectionModal: React.FC<LanguageSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectLanguage,
  currentLanguage
}) => {
  const languages = [
    'English',
    'French', 
    'Dutch',
    'Spanish',
    'Portugese'
  ];

  if (!isOpen) return null;

  return (
    <div className="language-modal-overlay" onClick={onClose}>
      <div className="language-modal" onClick={(e) => e.stopPropagation()}>
        <div className="language-modal-header">
          <h3 className="language-modal-title">Select Language</h3>
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
          </button>
        </div>
        
        <div className="language-options">
          {languages.map((language) => (
            <div
              key={language}
              className={`language-option ${currentLanguage === language ? 'selected' : ''}`}
              onClick={() => {
                onSelectLanguage(language);
                onClose();
              }}
            >
              <span className="language-name">{language}</span>
              {currentLanguage === language && (
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

export default LanguageSelectionModal;

