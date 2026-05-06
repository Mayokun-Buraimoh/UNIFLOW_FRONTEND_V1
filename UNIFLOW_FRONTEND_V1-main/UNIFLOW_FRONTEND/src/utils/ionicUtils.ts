// Web-compatible versions of Capacitor imports
// For web deployment, we'll use mock implementations
const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web'
};

const Haptics = {
  impact: async () => {}
};

const ImpactStyle = {
  Light: 'light'
};

const Keyboard = {
  show: async () => {},
  hide: async () => {}
};

/**
 * Check if the app is running on a native platform
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Trigger haptic feedback
 */
export const triggerHaptic = async (style: string = 'light'): Promise<void> => {
  if (isNativePlatform()) {
    try {
      await Haptics.impact();
    } catch (error) {
      console.warn('Haptic feedback not available:', error);
    }
  }
};

/**
 * Show keyboard
 */
export const showKeyboard = async (): Promise<void> => {
  if (isNativePlatform()) {
    try {
      await Keyboard.show();
    } catch (error) {
      console.warn('Keyboard show not available:', error);
    }
  }
};

/**
 * Hide keyboard
 */
export const hideKeyboard = async (): Promise<void> => {
  if (isNativePlatform()) {
    try {
      await Keyboard.hide();
    } catch (error) {
      console.warn('Keyboard hide not available:', error);
    }
  }
};

/**
 * Get platform info
 */
export const getPlatform = (): string => {
  return Capacitor.getPlatform();
};

/**
 * Check if running on iOS
 */
export const isIOS = (): boolean => {
  return getPlatform() === 'ios';
};

/**
 * Check if running on Android
 */
export const isAndroid = (): boolean => {
  return getPlatform() === 'android';
};

/**
 * Check if running on web
 */
export const isWeb = (): boolean => {
  return getPlatform() === 'web';
};

