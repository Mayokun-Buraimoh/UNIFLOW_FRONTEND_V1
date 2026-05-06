import React from 'react';
import './LogoutConfirmationModal.css';

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLogout: () => void;
  userName: string;
  userEmail: string;
}

const LogoutConfirmationModal: React.FC<LogoutConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirmLogout,
  userName,
  userEmail
}) => {
  if (!isOpen) return null;

  return (
    <div className="logout-modal-overlay" onClick={onClose}>
      <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="logout-modal-header">
          <h3 className="logout-modal-title">Logout Confirmation</h3>
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
          </button>
        </div>

        {/* User Profile Section */}
        <div className="logout-user-profile">
          <div className="logout-profile-avatar">
            <img src="/assets/icons/Avatars/default.jpg" alt="Profile" />
          </div>
          <h4 className="logout-user-name">{userName}</h4>
          <p className="logout-user-email">{userEmail}</p>
        </div>

        {/* Confirmation Message */}
        <div className="logout-message">
          <p className="logout-question">Are you sure you want to log out?</p>
        </div>

        {/* Action Buttons */}
        <div className="logout-actions">
          <button className="logout-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="logout-continue-btn" onClick={onConfirmLogout}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutConfirmationModal;



