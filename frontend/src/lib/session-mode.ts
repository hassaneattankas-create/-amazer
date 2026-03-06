"use client";

export type AppMode = "client" | "seller";

const APP_MODE_COOKIE_KEY = "amazer_app_mode";
const APP_MODE_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function persistAppMode(mode: AppMode): void {
  if (typeof window === "undefined") {
    return;
  }
  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${APP_MODE_COOKIE_KEY}=${mode}; Path=/; SameSite=Lax; Max-Age=${APP_MODE_COOKIE_MAX_AGE_SECONDS}${secureFlag}`;
}

export function clearAppMode(): void {
  if (typeof window === "undefined") {
    return;
  }
  document.cookie = `${APP_MODE_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

