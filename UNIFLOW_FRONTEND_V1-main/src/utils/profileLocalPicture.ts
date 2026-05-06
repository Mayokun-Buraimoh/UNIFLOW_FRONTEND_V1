/** When the profile API is unavailable (e.g. admin bypass), keep avatar choice on device. */
export const PROFILE_LOCAL_PICTURE_KEY = 'uniflow_local_profile_picture';

export function readStoredProfilePicture(): string | null {
  try {
    return localStorage.getItem(PROFILE_LOCAL_PICTURE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredProfilePicture(path: string): void {
  try {
    localStorage.setItem(PROFILE_LOCAL_PICTURE_KEY, path);
  } catch {
    /* ignore */
  }
}
