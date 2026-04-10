import type { CapacitorConfig } from "@capacitor/cli";

const hostedMobileUrlDefault =
  process.env.NEXT_PUBLIC_MOBILE_APP === "true" ? "https://amazerniger.vercel.app" : "";
const mobileServerUrl = process.env.CAPACITOR_SERVER_URL?.trim() || hostedMobileUrlDefault;
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
