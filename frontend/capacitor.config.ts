import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Vide par défaut = WebView charge le bundle `out/` (APK autonome côté UI).
 * Pour charger un site distant : CAPACITOR_SERVER_URL=https://...
 */
const rawCapServer = process.env.CAPACITOR_SERVER_URL;
const mobileServerUrl =
  rawCapServer !== undefined && rawCapServer !== null ? rawCapServer.trim() : "";
const usesRemoteServer = Boolean(mobileServerUrl);
const allowedNavigationHosts = new Set(["amazerniger.vercel.app", "amazer-api.onrender.com"]);

if (mobileServerUrl) {
  try {
    allowedNavigationHosts.add(new URL(mobileServerUrl).hostname);
  } catch {
    // Ignore invalid CAPACITOR_SERVER_URL values and keep the safe defaults.
  }
}

const config: CapacitorConfig = {
  appId: "ne.amazer.app",
  appName: "AMAZER",
  webDir: usesRemoteServer ? "public" : "out",
  server: usesRemoteServer
    ? {
        url: mobileServerUrl,
        cleartext: false,
        androidScheme: "https",
        allowNavigation: [...allowedNavigationHosts],
      }
    : {
        cleartext: false,
        androidScheme: "https",
        allowNavigation: [...allowedNavigationHosts],
      },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#FFFFFF",
      showSpinner: false,
    },
    LocalNotifications: {
      sound: "amazer_alert.wav",
    },
  },
};

export default config;
