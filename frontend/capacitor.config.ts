import type { CapacitorConfig } from "@capacitor/cli";

const mobileServerUrl = process.env.CAPACITOR_SERVER_URL?.trim();
const usesRemoteServer = Boolean(mobileServerUrl);

const config: CapacitorConfig = {
  appId: "ne.amazer.app",
  appName: "AMAZER",
  webDir: usesRemoteServer ? "public" : "out",
  server: usesRemoteServer
    ? {
        url: mobileServerUrl,
        cleartext: false,
        androidScheme: "https",
      }
    : {
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
