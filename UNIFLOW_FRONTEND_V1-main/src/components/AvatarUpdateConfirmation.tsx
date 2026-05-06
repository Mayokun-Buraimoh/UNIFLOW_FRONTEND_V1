import React from 'react';
import './AvatarUpdateConfirmation.css';

interface AvatarUpdateConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  newAvatar: string;
}

const AvatarUpdateConfirmation: React.FC<AvatarUpdateConfirmationProps> = ({
  isOpen,
  onClose,
  newAvatar
}) => {
  if (!isOpen) return null;

  return (
    <div className="confirmation-modal-overlay" onClick={onClose}>
      <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirmation-title">Your avatar has been updated :)</h3>
        
        <div className="updated-avatar-container">
          <img src={newAvatar} alt="Updated Avatar" className="updated-avatar" />
        </div>
        
        <button className="continue-btn" onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  );
};

export default AvatarUpdateConfirmation;
