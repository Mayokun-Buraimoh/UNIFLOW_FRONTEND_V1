import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uniflow.app',
  appName: 'UniFlow',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    // Live reload from Vite while testing in Xcode simulator (optional):
    // url: 'http://localhost:5173',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      backgroundColor: "#447055",
      showSpinner: true,
      spinnerColor: "#4CAF50"
    },
    StatusBar: {
      // Capacitor's StatusBar enum is inverted: 'DARK' = white text, 'LIGHT' = dark text.
      // We use 'DEFAULT' here so iOS picks a sensible style during the brief native
      // launch window; once the React app mounts, `StatusBarController` in App.tsx
      // (and per-page `useStatusBarStyle` calls) drive the style based on the route.
      // Android only: backgroundColor is honored when overlaysWebView is false.
      style: 'DEFAULT',
      backgroundColor: '#ffffff',
      overlaysWebView: false
    }
  }
};

export default config;

