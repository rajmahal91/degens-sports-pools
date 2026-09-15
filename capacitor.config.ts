import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.degens.sportspools",
  appName: "Degens Sports Pools",
  webDir: "out",
  server: {
    url: "https://degens-sports-pools-iota.vercel.app",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
