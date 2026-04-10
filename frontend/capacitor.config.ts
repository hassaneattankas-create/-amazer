import type { CapacitorConfig } from "@capacitor/cli";

/** Par défaut : même expérience que le site (évite écarts APK / cookies). Surcharge avec CAPACITOR_SERVER_URL. */
const defaultHostedSite = "https://amazerniger.vercel.app";
const rawCapServer = process.env.CAPACITOR_SERVER_URL;
const mobileServerUrl =
  rawCapServer !== undefined && rawCapServer !== null
    ? rawCapServer.trim() || ""
    : defaultHostedSite;
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
  },
};

export default config;
