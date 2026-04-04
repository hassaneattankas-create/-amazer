import { api } from "@/lib/api";
import { useNotificationStore } from "@/store/notification-store";

const TOKEN_STORAGE_KEY = "amazer_notification_token_registered";
const LAST_WEB_NOTIFICATION_KEY = "amazer_last_web_notification";

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

export function notifyLocalOrderEvent(payload: {
  title: string;
  body: string;
  tag: string;
  href?: string;
}) {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return;
  }
  useNotificationStore.getState().pushNotification(payload);
  if (Notification.permission !== "granted") {
    return;
  }
  const dedupeKey = `${payload.tag}:${payload.body}`;
  const previous = window.localStorage.getItem(LAST_WEB_NOTIFICATION_KEY);
  if (previous === dedupeKey) {
    return;
  }
  window.localStorage.setItem(LAST_WEB_NOTIFICATION_KEY, dedupeKey);
  try {
    new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag,
    });
  } catch {
    // Silencieux: on garde le polling meme si la notification locale echoue.
  }
}
