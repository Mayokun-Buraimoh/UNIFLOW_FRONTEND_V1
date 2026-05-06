import { useState, useEffect, useCallback } from 'react';
import { profileService, Profile } from '../api/services';
import { cacheAppPreferencesFromProfile } from '../utils/appPreferences';
import { readStoredProfilePicture, writeStoredProfilePicture } from '../utils/profileLocalPicture';

export const PROFILE_UPDATED_EVENT = 'uniflow_profile_updated';

export const useProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const profileData = await profileService.getProfile();
      const localPic = readStoredProfilePicture();
      const merged: Profile = {
        ...profileData,
        profilePicture: profileData.profilePicture || localPic || undefined,
      };
      setProfile(merged);
      cacheAppPreferencesFromProfile(
        merged?.preferences as Record<string, unknown> | undefined
      );
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profile');
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update profile
  const updateProfile = useCallback(async (data: Partial<Profile>) => {
    try {
      setLoading(true);
      setError(null);
      const updatedProfile = await profileService.updateProfile(data);
      const merged: Profile = {
        ...updatedProfile,
        profilePicture:
          updatedProfile.profilePicture ?? data.profilePicture ?? undefined,
      };
      if (merged.profilePicture) {
        writeStoredProfilePicture(merged.profilePicture);
      }
      setProfile(merged);
      cacheAppPreferencesFromProfile(
        merged?.preferences as Record<string, unknown> | undefined
      );
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
      return merged;
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update notification settings
  const updateNotificationSettings = useCallback(async (notificationSettings: any) => {
    try {
      setLoading(true);
      setError(null);
      await profileService.updateNotificationSettings(notificationSettings);
      // Refresh profile to get updated data
      await fetchProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to update notification settings');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  // Update study goals
  const updateStudyGoals = useCallback(async (studyGoals: any) => {
    try {
      setLoading(true);
      setError(null);
      await profileService.updateStudyGoals(studyGoals);
      // Refresh profile to get updated data
      await fetchProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to update study goals');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  // Update preferences
  const updatePreferences = useCallback(async (preferences: any) => {
    try {
      setLoading(true);
      setError(null);
      await profileService.updatePreferences(preferences);
      // Refresh profile to get updated data
      await fetchProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to update preferences');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  // Load profile on mount
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const onUpdated = () => {
      fetchProfile();
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdated);
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    fetchProfile,
    updateProfile,
    updateNotificationSettings,
    updateStudyGoals,
    updatePreferences,
  };
};