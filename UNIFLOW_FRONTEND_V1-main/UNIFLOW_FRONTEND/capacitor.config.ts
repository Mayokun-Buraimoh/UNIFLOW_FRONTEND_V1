import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uniflow.app',
  appName: 'UniFlow',
  webDir: 'dist',
  server: {
    // `https` app origin blocks fetch() to http:// LAN or host machine (mixed content).
    // `http` still allows https:// API URLs (e.g. ngrok). Pair with cleartext config for HTTP APIs.
    androidScheme: 'http'
  },
  plugins: {
    // PushNotifications: {
    //   presentationOptions: ['badge', 'sound', 'alert'],
    // },
    SplashScreen: {
      launchShowDuration: 3000,
      backgroundColor: "#447055",
      showSpinner: true,
      spinnerColor: "#4CAF50"
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#ffffff'
    }
  }
};

export default config;

