import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfile } from '../hooks/useProfile';
import { useAuth } from '../contexts/AuthContext';
import InlineDropdown, { DropdownOption } from '../components/InlineDropdown';
import './AppPreferences.css';
import BackButton from '../components/BackButton';
import { writeCachedAppPreferences, type WeekStartPreference } from '../utils/appPreferences';

const AppPreferences: React.FC = () => {
  const history = useHistory();
  const { user } = useAuth();
  const { profile, updatePreferences, loading } = useProfile();
  const { t, i18n } = useTranslation();
  const [defaultLanguage, setDefaultLanguage] = useState('English');
  const [defaultStartPage, setDefaultStartPage] = useState('Home');
  const [weekStart, setWeekStart] = useState('Monday');
  const [isUpdating, setIsUpdating] = useState(false);

  // Track which dropdown is currently open
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Define options for dropdowns
  const languageOptions: DropdownOption[] = [
    { label: 'English', value: 'English' },
    { label: 'French', value: 'French' },
    { label: 'Dutch', value: 'Dutch' },
    { label: 'Spanish', value: 'Spanish' },
    { label: 'Portugese', value: 'Portugese' },
  ];

  const startPageOptions: DropdownOption[] = [
    { label: 'Home', value: 'Home' },
    { label: 'Plans', value: 'Plans' },
    { label: 'Courses', value: 'Courses' },
    { label: 'Weekly Schedule', value: 'Weekly Schedule' },
    { label: 'ChatBot', value: 'ChatBot' },
  ];

  const weekStartOptions: DropdownOption[] = [
    { label: 'Sunday', value: 'Sunday' },
    { label: 'Monday', value: 'Monday' },
  ];

  // Load preferences from profile
  useEffect(() => {
    if (profile?.preferences) {
      const prefs = profile.preferences;
      setDefaultLanguage(prefs.defaultLanguage ?? 'English');
      setDefaultStartPage(prefs.defaultStartPage ?? 'Home');
      setWeekStart(prefs.weekStart ?? 'Monday');
      if (prefs.defaultLanguage) i18n.changeLanguage(prefs.defaultLanguage);
    }
  }, [profile, i18n]);

  const handleUpdate = async () => {
    try {
      setIsUpdating(true);
      const preferences = {
        streakCount: profile?.preferences?.streakCount ?? true,
        defaultLanguage,
        defaultStartPage,
        weekStart
      };

      await updatePreferences(preferences);
      writeCachedAppPreferences({
        defaultStartPage,
        weekStart: weekStart as WeekStartPreference,
      });
      console.log('App preferences updated successfully');
      history.goBack();
    } catch (error) {
      console.error('Failed to update app preferences:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleDropdown = (dropdownId: string) => {
    setOpenDropdown(openDropdown === dropdownId ? null : dropdownId);
  };

  return (
    <IonPage className="app-preferences-page">
      <IonContent fullscreen className="app-preferences-screen">
          {/* Status Bar Spacer */}
          <div className="status-bar-spacer"></div>

          {/* Header */}
          <div className="app-preferences-header">
            <BackButton />
            <h1 className="app-preferences-title">{t('app_preferences')}</h1>
          </div>

          {/* User Profile Information */}
          <div className="user-profile-section">
            <div className="profile-picture">
              <div className="profile-avatar">
                <img src={profile?.profilePicture || "/assets/icons/Avatars/default.jpg"} alt="Profile" />
              </div>
            </div>
            <div className="user-info">
              <h2 className="user-name">{user?.name || "User"}</h2>
              <p className="user-email">{user?.email || ""}</p>
            </div>
          </div>

          {/* App Preferences Section */}
          <div className="preferences-section">
            <div className="preferences-card">
              <InlineDropdown
                label={t('default_language')}
                options={languageOptions}
                selectedValue={defaultLanguage}
                isOpen={openDropdown === 'language'}
                onSelect={(val) => {
                  setDefaultLanguage(val);
                  localStorage.setItem('uniflow_language', val);
                  i18n.changeLanguage(val);
                  setOpenDropdown(null);
                }}
                onToggle={() => handleToggleDropdown('language')}
              />

              <InlineDropdown
                label={t('default_start_page')}
                options={startPageOptions}
                selectedValue={defaultStartPage}
                isOpen={openDropdown === 'startPage'}
                onSelect={(val) => {
                  setDefaultStartPage(val);
                  setOpenDropdown(null);
                }}
                onToggle={() => handleToggleDropdown('startPage')}
              />

              <InlineDropdown
                label={t('week_start')}
                options={weekStartOptions}
                selectedValue={weekStart}
                isOpen={openDropdown === 'weekStart'}
                onSelect={(val) => {
                  setWeekStart(val);
                  setOpenDropdown(null);
                }}
                onToggle={() => handleToggleDropdown('weekStart')}
              />
            </div>
          </div>

          {/* Update Button */}
          <div className="update-section">
            <button
              className="update-button"
              onClick={handleUpdate}
              disabled={isUpdating || loading}
            >
              {isUpdating ? t('updating') : t('update')}
            </button>
          </div>
      </IonContent>
    </IonPage>
  );
};

export default AppPreferences;
