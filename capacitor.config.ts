import type { CapacitorConfig } from '@capacitor/cli';

const liveServerUrl=process.env.CAPACITOR_LIVE_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.sportssyndicate.fantasy",
  appName: "Sports Syndicate Fantasy",
  webDir: "native-shell",
  ...(liveServerUrl?{server:{url:liveServerUrl,cleartext:false,allowNavigation:[new URL(liveServerUrl).hostname]}}:{}),
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: "#0b0e13",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#0b0e13",
      overlaysWebView: false,
    },
  },
};

export default config;
