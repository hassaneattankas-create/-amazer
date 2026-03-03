import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ne.amazer.app",
  appName: "AMAZER",
  webDir: "public",
  server: {
    url: "https://amazer.vercel.app",
    cleartext: false,
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#FFFFFF",
      showSpinner: false,
    },
  },
};

export default config;
