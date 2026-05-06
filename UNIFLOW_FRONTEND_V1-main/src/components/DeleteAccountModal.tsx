import React, { useState } from 'react';
import './DeleteAccountModal.css';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  userEmail: string;
  isLoading?: boolean;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userEmail,
  isLoading = false
}) => {
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [error, setError] = useState(false);
  const isConfirmed = confirmationPhrase.trim().toUpperCase() === 'DELETE';

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (isConfirmed) {
      await onConfirm();
    } else {
      setError(true);
    }
  };

  return (
    <div className="delete-modal-overlay" onClick={isLoading ? undefined : onClose}>
      <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF5252" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h3 className="delete-modal-title">Delete Account?</h3>
        <p className="delete-modal-warning">
          This action is <strong>permanent</strong> and cannot be undone. All your data, notes, and plans will be lost forever.
        </p>

        <div className="delete-confirmation-box">
          <p className="delete-instruction">
            Type <strong>DELETE</strong> to confirm:
          </p>
          <input
            type="text"
            className={`delete-input ${error ? 'error' : ''}`}
            placeholder="DELETE"
            value={confirmationPhrase}
            onChange={(e) => {
              setConfirmationPhrase(e.target.value);
              setError(false);
            }}
            autoFocus
            disabled={isLoading}
          />
          {error && <p className="delete-error-msg">Please type "DELETE" exactly to proceed.</p>}
        </div>

        <div className="delete-modal-actions">
          <button className="delete-cancel-btn" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button 
            className="delete-confirm-btn" 
            onClick={handleConfirm}
            disabled={!isConfirmed || isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountModal;
