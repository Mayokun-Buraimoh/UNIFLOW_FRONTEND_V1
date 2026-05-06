import React from 'react';
import { createPortal } from 'react-dom';
import './AvatarSelectionModal.css';

interface AvatarSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAvatar: (avatarPath: string) => void;
  onUpdate: () => void | Promise<void>;
  /** Path for the green selection ring (must match clicked choice). */
  selectedAvatar: string;
  isSaving?: boolean;
}

const AvatarSelectionModal: React.FC<AvatarSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectAvatar,
  onUpdate,
  selectedAvatar,
  isSaving = false,
}) => {
  const avatars = [
    { id: 'default', name: 'Default', path: '/assets/icons/Avatars/default.jpg' },
    { id: 'gamepfp', name: 'Gaming', path: '/assets/icons/Avatars/gamepfp.jpg' },
    { id: 'girl1', name: 'Girl 1', path: '/assets/icons/Avatars/girl1.jpg' },
    { id: 'girl2', name: 'Girl 2', path: '/assets/icons/Avatars/girl2.jpg' },
    { id: 'guy1', name: 'Guy 1', path: '/assets/icons/Avatars/guy1.jpg' },
    { id: 'guy2', name: 'Guy 2', path: '/assets/icons/Avatars/guy2.jpg' },
  ];

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const modal = (
    <div className="avatar-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="avatar-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-modal-title"
      >
        <h3 id="avatar-modal-title" className="avatar-modal-title">
          select an avatar for your profile
        </h3>

        <div className="avatar-grid">
          {avatars.map((avatar) => (
            <div
              key={avatar.id}
              className={`avatar-option ${selectedAvatar === avatar.path ? 'selected' : ''}`}
              onClick={() => onSelectAvatar(avatar.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectAvatar(avatar.path);
                }
              }}
            >
              <img src={avatar.path} alt={avatar.name} draggable={false} />
            </div>
          ))}
        </div>

        <button
          type="button"
          className="avatar-update-btn"
          disabled={isSaving}
          onClick={() => {
            void Promise.resolve(onUpdate());
          }}
        >
          {isSaving ? 'Saving…' : 'Update'}
        </button>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default AvatarSelectionModal;
