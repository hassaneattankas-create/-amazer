import { api } from "@/lib/api";

const TOKEN_STORAGE_KEY = "amazer_notification_token_registered";

export async function requestAndRegisterNotifications() {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return;
  }
  if (window.localStorage.getItem(TOKEN_STORAGE_KEY) === "1") {
    return;
  }

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return;
  }
  if (permission !== "granted") {
    return;
  }

  // Simple device fingerprint as token placeholder; can be replaced by FCM token later.
  const deviceToken = `${navigator.userAgent}::${Math.random().toString(36).slice(2)}`;

  try {
    await api.post("/api/v1/notifications/register-token", {
      device_token: deviceToken,
    });
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "1");
  } catch {
    // Silencieux: on ne bloque pas l UX si la notification echoue.
  }
}

