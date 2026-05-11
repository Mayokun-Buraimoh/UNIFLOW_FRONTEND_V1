import { IonContent, IonPage } from '@ionic/react';
import { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile, PROFILE_UPDATED_EVENT } from '../hooks/useProfile';
import { writeStoredProfilePicture } from '../utils/profileLocalPicture';
import AvatarSelectionModal from '../components/AvatarSelectionModal';
import AvatarUpdateConfirmation from '../components/AvatarUpdateConfirmation';
import './Profile.css';
import BackButton from '../components/BackButton';
import { useBlockRightSwipe } from '../hooks/useBlockRightSwipe';

const Profile: React.FC = () => {
  const DEFAULT_AVATAR = '/assets/icons/Avatars/default.jpg';
  const history = useHistory();
  const { user, logoutWithConfirmation, updateProfile, changePassword, refreshUser } = useAuth();
  const { profile, loading: profileLoading, updateProfile: updateProfileSettings } = useProfile();
  
  const [currentAvatar, setCurrentAvatar] = useState(DEFAULT_AVATAR);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATAR);
  const [avatarSaving, setAvatarSaving] = useState(false);

  // Form field states
  const [phoneNumber, setPhoneNumber] = useState('+234 123 456 7890');
  const [school, setSchool] = useState('Covenant University');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  
  // Edit states
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingSchool, setIsEditingSchool] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  
  // Load profile data on component mount
  useEffect(() => {
    if (profile) {
      setSchool(profile.school || 'Covenant University');
      setPhoneNumber(profile.phoneNumber || '+234 123 456 7890');
      const resolvedAvatar = profile.profilePicture || DEFAULT_AVATAR;
      setCurrentAvatar(resolvedAvatar);
      setSelectedAvatar(resolvedAvatar);
    }
  }, [profile]);
  
  // Refresh user data on component mount if needed
  useEffect(() => {
    const checkAndRefreshUser = async () => {
      const token = localStorage.getItem('uniflow_token');
      const storedUser = localStorage.getItem('uniflow_user');
      
      // If we have a token but no user data, refresh it
      if (token && !storedUser && !user) {
        await refreshUser();
      }
    };
    
    checkAndRefreshUser();
  }, [user, refreshUser]);

  useBlockRightSwipe();

  const handleEditAvatar = () => {
    setSelectedAvatar(currentAvatar);
    setIsAvatarModalOpen(true);
  };

  const handleSelectAvatar = (avatarPath: string) => {
    setSelectedAvatar(avatarPath);
  };

  const handleUpdateAvatar = async () => {
    if (avatarSaving) return;
    const previousAvatar = currentAvatar;
    const nextAvatar = selectedAvatar || DEFAULT_AVATAR;
    // Optimistic update so avatar switches instantly in the UI.
    setCurrentAvatar(nextAvatar);
    setAvatarSaving(true);
    try {
      await updateProfileSettings({ profilePicture: nextAvatar });
      setIsAvatarModalOpen(false);
      setIsConfirmationModalOpen(true);
    } catch (error) {
      console.error('Failed to save avatar:', error);
      writeStoredProfilePicture(nextAvatar);
      setCurrentAvatar(previousAvatar);
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

  const handleCloseConfirmation = () => {
    setIsConfirmationModalOpen(false);
  };

  // Edit handlers
  const handleEditPhone = () => {
    setIsEditingPhone(true);
  };

  const handleEditSchool = () => {
    setIsEditingSchool(true);
  };

  const handleEditPassword = () => {
    setIsEditingPassword(true);
  };

  const handleSavePhone = async () => {
    try {
      await updateProfileSettings({ phoneNumber });
      setIsEditingPhone(false);
      console.log('Phone number updated:', phoneNumber);
    } catch (error) {
      console.error('Failed to update phone number:', error);
    }
  };

  const handleSaveSchool = async () => {
    try {
      await updateProfileSettings({ school });
      setIsEditingSchool(false);
      console.log('School updated:', school);
    } catch (error) {
      console.error('Failed to update school:', error);
    }
  };

  const handleSavePassword = async () => {
    try {
      await changePassword(currentPassword, newPassword);
      setIsEditingPassword(false);
      setNewPassword('');
      setCurrentPassword('');
      console.log('Password updated');
    } catch (error) {
      console.error('Failed to change password:', error);
    }
  };

  const handleUpdateProfile = () => {
    // Handle profile update logic here
    console.log('Profile updated');
  };

  return (
    <IonPage>
      <IonContent fullscreen className="profile-screen">

        {/* Status Bar Spacer */}
        <div className="status-bar-spacer"></div>

        {/* Header */}
        <div className="profile-header">
          <BackButton />
        </div>

        {/* Profile Section */}
        <div className="profile-section">
          <div className="profile-picture-container">
            <div className="profile-picture">
              <img src={currentAvatar} alt="Profile" className="profile-avatar-img" />
            </div>
            <button className="edit-profile-btn" onClick={handleEditAvatar}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.98804 14.6743L15.2322 3.71295L16.4406 3.39223L19.7292 6.16564L19.617 7.41082L10.3728 18.3721L5.53923 19.655L5.98804 14.6743Z" stroke="black"/>
                <path d="M13.5 5.50003L18 9.50003" stroke="black"/>
              </svg>
            </button>
          </div>
                                                       <h1 className="profile-name">{user?.name || 'User'}</h1>
          <p className="profile-institution">Covenant University</p>
        </div>

        {/* User Information Form */}
        <div className="profile-form">
                                           <div className="form-group">
              <label className="form-label">Your Email</label>
              <div className="input-field">
                <img src="/assets/icons/icons2/message_icon.svg" alt="Email" className="input-icon" />
                <input 
                  type="email" 
                  placeholder="user@apple.com" 
                  className="form-input"
                  value={user?.email || ''}
                  readOnly
                />
              </div>
            </div>

                                           <div className="form-group">
              <label className="form-label">Phone Number</label>
              <div className="input-field">
                <img src="/assets/icons/icons2/phone_icon.svg" alt="Phone" className="input-icon" />
                <input 
                  type="text" 
                  placeholder="+234 123 456 7890" 
                  className="form-input"
                  value={phoneNumber}
                  readOnly={!isEditingPhone}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                {isEditingPhone ? (
                  <button className="save-field-btn" onClick={handleSavePhone}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" stroke="#4CAF50" strokeWidth="2"/>
                    </svg>
                  </button>
                ) : (
                  <button className="edit-field-btn" onClick={handleEditPhone}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5.98804 14.6743L15.2322 3.71295L16.4406 3.39223L19.7292 6.16564L19.617 7.41082L10.3728 18.3721L5.53923 19.655L5.98804 14.6743Z" stroke="black"/>
                      <path d="M13.5 5.50003L18 9.50003" stroke="black"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

          <div className="form-group">
            <label className="form-label">School</label>
            <div className="input-field">
              <input 
                type="text" 
                placeholder="Covenant University" 
                className="form-input"
                value={school}
                readOnly={!isEditingSchool}
                onChange={(e) => setSchool(e.target.value)}
              />
              {isEditingSchool ? (
                <button className="save-field-btn" onClick={handleSaveSchool}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" stroke="#4CAF50" strokeWidth="2"/>
                  </svg>
                </button>
              ) : (
                <button className="edit-field-btn" onClick={handleEditSchool}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5.98804 14.6743L15.2322 3.71295L16.4406 3.39223L19.7292 6.16564L19.617 7.41082L10.3728 18.3721L5.53923 19.655L5.98804 14.6743Z" stroke="black"/>
                    <path d="M13.5 5.50003L18 9.50003" stroke="black"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

                     <div className="form-group">
             <label className="form-label">Change Password</label>
             <div className="input-field">
               <input 
                 type="password" 
                 placeholder="Enter new password" 
                 className="form-input"
                 value={newPassword}
                 readOnly={!isEditingPassword}
                 onChange={(e) => setNewPassword(e.target.value)}
               />
               {isEditingPassword ? (
                 <button className="save-field-btn" onClick={handleSavePassword}>
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                     <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" stroke="#4CAF50" strokeWidth="2"/>
                   </svg>
                 </button>
               ) : (
                 <button className="edit-field-btn" onClick={handleEditPassword}>
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                     <path d="M5.98804 14.6743L15.2322 3.71295L16.4406 3.39223L19.7292 6.16564L19.617 7.41082L10.3728 18.3721L5.53923 19.655L5.98804 14.6743Z" stroke="black"/>
                     <path d="M13.5 5.50003L18 9.50003" stroke="black"/>
                   </svg>
                 </button>
               )}
             </div>
           </div>
        </div>

        {/* Update Button */}
                       <div className="update-section">
                 <button className="update-button" onClick={handleUpdateProfile}>Update</button>
               </div>

        {/* Avatar Selection Modal */}
        <AvatarSelectionModal
          isOpen={isAvatarModalOpen}
          onClose={() => setIsAvatarModalOpen(false)}
          onSelectAvatar={handleSelectAvatar}
          onUpdate={handleUpdateAvatar}
          selectedAvatar={selectedAvatar}
          isSaving={avatarSaving}
        />

        {/* Avatar Update Confirmation Modal */}
        <AvatarUpdateConfirmation
          isOpen={isConfirmationModalOpen}
          onClose={handleCloseConfirmation}
          newAvatar={currentAvatar}
        />
      </IonContent>
    </IonPage>
  );
};

export default Profile;
