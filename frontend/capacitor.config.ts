import type { CapacitorConfig } from "@capacitor/cli";

const mobileServerUrl = process.env.CAPACITOR_SERVER_URL || "https://amazerniger.vercel.app";

const config: CapacitorConfig = {
  appId: "ne.amazer.app",
  appName: "AMAZER",
  webDir: "public",
  server: {
    url: mobileServerUrl,
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
