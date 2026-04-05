"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { BackButtonListenerEvent } from "@capacitor/app";

function currentLocationKey(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function AndroidBackButtonHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    let removeListener: (() => Promise<void>) | undefined;

    const registerListener = async () => {
      const listener = await App.addListener("backButton", ({ canGoBack }: BackButtonListenerEvent) => {
        const currentLocation = currentLocationKey();
        if (canGoBack) {
          window.history.back();
          return;
        }

        // When the app opens directly on a nested route, mimic browser back
        // by returning to the home page instead of closing immediately.
        if (currentLocation !== "/") {
          window.location.assign("/");
          return;
        }

        App.exitApp();
      });

      removeListener = () => listener.remove();
    };

    void registerListener();

    return () => {
      if (removeListener) {
        void removeListener();
      }
    };
  }, []);

  return null;
}
