import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Settings.css';
import BackButton from '../components/BackButton';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AvatarSelectionModal from '../components/AvatarSelectionModal';
import AvatarUpdateConfirmation from '../components/AvatarUpdateConfirmation';
import { useProfile, PROFILE_UPDATED_EVENT } from '../hooks/useProfile';
import { writeStoredProfilePicture } from '../utils/profileLocalPicture';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

const Settings: React.FC = () => {
  const history = useHistory();
  const { user, logoutWithConfirmation } = useAuth();
  const { profile, updateProfile: saveProfile } = useProfile();
  const { currentPlanDetails } = useSubscription();
  const { t } = useTranslation();

  const [currentAvatar, setCurrentAvatar] = useState('/assets/icons/Avatars/default.jpg');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('/assets/icons/Avatars/default.jpg');
  const [avatarSaving, setAvatarSaving] = useState(false);

  useEffect(() => {
    if (profile?.profilePicture) {
      setCurrentAvatar(profile.profilePicture);
      setSelectedAvatar(profile.profilePicture);
    }
  }, [profile]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    StatusBar.setBackgroundColor({ color: '#FFFFFF' }).catch(() => {});
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  }, []);

  const handleEditAvatar = () => {
    setSelectedAvatar(currentAvatar);
    setIsAvatarModalOpen(true);
  };

  const handleSelectAvatar = (avatarPath: string) => {
    setSelectedAvatar(avatarPath);
  };

  const handleUpdateAvatar = async () => {
    if (avatarSaving) return;
    setAvatarSaving(true);
    try {
      await saveProfile({ profilePicture: selectedAvatar });
      setCurrentAvatar(selectedAvatar);
      setIsAvatarModalOpen(false);
      setIsConfirmationModalOpen(true);
    } catch (error) {
      console.error('Failed to save avatar:', error);
      writeStoredProfilePicture(selectedAvatar);
      setCurrentAvatar(selectedAvatar);
      setIsAvatarModalOpen(false);
      setIsConfirmationModalOpen(true);
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
      alert(
        'Could not save to the server (check connection or admin bypass). Your avatar was saved on this device.'
      );
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleNotificationPreferences = () => {
    history.push('/notification-preferences');
  };

  const handleAppPreferences = () => {
    history.push('/app-preferences');
  };

  const handlePricing = () => {
    history.push('/pricing');
  };

  const handleLogout = () => {
    logoutWithConfirmation();
  };

  return (
    <>
      <IonPage className="settings-page">
        <IonContent fullscreen className="settings-screen">
          <div className="status-bar-spacer"></div>

          <div className="settings-body">
            <div className="settings-header">
              <BackButton />
              <h1 className="settings-title">{t('settings')}</h1>
            </div>

            <div className="user-profile-section">
              <div className="profile-picture-container" style={{ position: 'relative', display: 'inline-block' }}>
                <div className="profile-avatar">
                  <img src={currentAvatar} alt="Profile" />
                </div>
                <button
                  className="edit-avatar-btn"
                  onClick={handleEditAvatar}
                  style={{
                    position: 'absolute',
                    bottom: '0',
                    right: '-10px',
                    background: '#4CAF50',
                    border: '3px solid white',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    zIndex: 10
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14.06 9L15 9.94L5.92 19H5V18.08L14.06 9ZM17.66 3C17.41 3 17.15 3.1 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04C21.1 6.65 21.1 6 20.71 5.63L18.37 3.29C18.17 3.09 17.92 3 17.66 3ZM14.06 6.19L3 17.25V21H6.75L17.81 9.94L14.06 6.19Z" fill="white"/>
                  </svg>
                </button>
              </div>
              <h2 className="user-name">{user?.name || 'User'}</h2>
              <p className="user-email">{user?.email || 'user@example.com'}</p>
            </div>

            <div className="settings-section">
              <h3 className="section-title">Account Settings</h3>
              <div className="settings-card">
                <div className="setting-item" onClick={handleNotificationPreferences}>
                  <div className="setting-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#4CAF50">
                      <path d="M12,22A2,2 0 0,1 10,20A2,2 0 0,1 12,18A2,2 0 0,1 14,20A2,2 0 0,1 12,22M13,2V4.47L14,4.82A8,8 0 0,1 12,2M13,16.5V19H12A8,8 0 0,1 13,16.5M16.82,10H19.5A8,8 0 0,1 16.82,12L16.47,13L16.82,10M4.47,13L4.18,12A8,8 0 0,1 4.47,13H7.18L7.53,12L4.47,13M4.18,11A8,8 0 0,1 4.47,10H7.18L7.53,11L4.18,11M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                    </svg>
                  </div>
                  <div className="setting-content">
                    <h4 className="setting-title">Notification & Reminders</h4>
                    <p className="setting-description">Control the notifications you receive.</p>
                  </div>
                  <div className="setting-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#666">
                      <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                    </svg>
                  </div>
                </div>

                <div className="setting-item" onClick={handleAppPreferences}>
                  <div className="setting-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#4CAF50">
                      <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
                    </svg>
                  </div>
                  <div className="setting-content">
                    <h4 className="setting-title">{t('app_preferences')}</h4>
                    <p className="setting-description">Select your preferences.</p>
                  </div>
                  <div className="setting-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#666">
                      <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                    </svg>
                  </div>
                </div>

                <div className="setting-item" onClick={handlePricing}>
                  <div className="setting-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#4CAF50">
                      <path d="M12,1L15.09,8.26L23,9.27L17,14.14L18.82,22L12,17.77L5.18,22L7,14.14L1,9.27L8.91,8.26L12,1M12,4.15L10.12,8.56L5.32,9.17L8.96,12.13L7.84,16.8L12,14.28L16.16,16.8L15.04,12.13L18.68,9.17L13.88,8.56L12,4.15Z" />
                    </svg>
                  </div>
                  <div className="setting-content">
                    <h4 className="setting-title">Pricing</h4>
                    <p className="setting-description">
                      {currentPlanDetails.name} plan · {currentPlanDetails.priceLabel}
                    </p>
                  </div>
                  <div className="setting-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#666">
                      <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                    </svg>
                  </div>
                </div>

                <div className="setting-item" onClick={handleLogout}>
                  <div className="setting-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#4CAF50">
                      <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                    </svg>
                  </div>
                  <div className="setting-content">
                    <h4 className="setting-title">{t('log_out')}</h4>
                    <p className="setting-description">Sign out from this account.</p>
                  </div>
                  <div className="setting-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#666">
                      <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3 className="section-title">More</h3>
              <div className="settings-card">
                <div className="setting-item">
                  <div className="setting-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#4CAF50">
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                    </svg>
                  </div>
                  <div className="setting-content">
                    <h4 className="setting-title">Help & Support</h4>
                    <p className="setting-description">Get help and support.</p>
                  </div>
                  <div className="setting-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#666">
                      <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                    </svg>
                  </div>
                </div>

                <div className="setting-item">
                  <div className="setting-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#4CAF50">
                      <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>
                    </svg>
                  </div>
                  <div className="setting-content">
                    <h4 className="setting-title">About App</h4>
                    <p className="setting-description">Learn more about the app.</p>
                  </div>
                  <div className="setting-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#666">
                      <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </IonContent>

        <AvatarSelectionModal
          isOpen={isAvatarModalOpen}
          onClose={() => setIsAvatarModalOpen(false)}
          onSelectAvatar={handleSelectAvatar}
          onUpdate={handleUpdateAvatar}
          selectedAvatar={selectedAvatar}
          isSaving={avatarSaving}
        />

        <AvatarUpdateConfirmation
          isOpen={isConfirmationModalOpen}
          onClose={() => setIsConfirmationModalOpen(false)}
          newAvatar={currentAvatar}
        />
      </IonPage>
    </>
  );
};

export default Settings;
