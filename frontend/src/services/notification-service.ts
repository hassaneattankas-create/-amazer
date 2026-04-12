import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import { api } from "@/lib/api";
import { useNotificationStore, type AppNotification } from "@/store/notification-store";

const TOKEN_STORAGE_KEY = "amazer_notification_token_registered";
const LAST_WEB_NOTIFICATION_KEY = "amazer_last_web_notification";
const ANDROID_ALERT_CHANNEL_ID = "amazer-alerts";
const NATIVE_ALERT_SOUND = "amazer_alert.wav";

let nativeNotificationReady: Promise<boolean> | null = null;

async function ensureNativeNotificationChannel(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  if (nativeNotificationReady) {
    return nativeNotificationReady;
  }
  nativeNotificationReady = (async () => {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === "granted") {
        if (Capacitor.getPlatform() === "android") {
          await LocalNotifications.createChannel({
            id: ANDROID_ALERT_CHANNEL_ID,
            name: "Alertes AMAZER",
            description: "Notifications importantes vendeur, commande et compte.",
            importance: 5,
            visibility: 1,
            vibration: true,
            sound: NATIVE_ALERT_SOUND,
          });
        }
        return true;
      }
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display === "granted" && Capacitor.getPlatform() === "android") {
        await LocalNotifications.createChannel({
          id: ANDROID_ALERT_CHANNEL_ID,
          name: "Alertes AMAZER",
          description: "Notifications importantes vendeur, commande et compte.",
          importance: 5,
          visibility: 1,
          vibration: true,
          sound: NATIVE_ALERT_SOUND,
        });
      }
      return perm.display === "granted";
    } catch {
      return false;
    }
  })();
  return nativeNotificationReady;
}

export async function requestAndRegisterNotifications() {
  if (typeof window === "undefined") {
    return;
  }

  if (Capacitor.isNativePlatform()) {
    const ok = await ensureNativeNotificationChannel();
    if (!ok || window.localStorage.getItem(TOKEN_STORAGE_KEY) === "1") {
      return;
    }
    const deviceToken = `cap-${Capacitor.getPlatform()}::${navigator.userAgent?.slice(0, 80) || "app"}::${Math.random().toString(36).slice(2)}`;
    try {
      await api.post("/api/v1/notifications/register-token", {
        device_token: deviceToken,
      });
      window.localStorage.setItem(TOKEN_STORAGE_KEY, "1");
    } catch {
      // Ne bloque pas l’UX
    }
    return;
  }

  if (typeof Notification === "undefined") {
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

export async function notifyLocalOrderEvent(payload: {
  title: string;
  body: string;
  tag: string;
  href?: string;
}) {
  if (typeof window === "undefined") {
    return;
  }
  useNotificationStore.getState().pushNotification(payload);

  if (Capacitor.isNativePlatform()) {
    const ok = await ensureNativeNotificationChannel();
    if (!ok) {
      return;
    }
    const dedupeKey = `${payload.tag}:${payload.body}`;
    const previous = window.localStorage.getItem(LAST_WEB_NOTIFICATION_KEY);
    if (previous === dedupeKey) {
      return;
    }
    window.localStorage.setItem(LAST_WEB_NOTIFICATION_KEY, dedupeKey);
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 2_000_000_000),
            title: payload.title,
            body: payload.body,
            schedule: { at: new Date(Date.now() + 400) },
            sound: NATIVE_ALERT_SOUND,
            channelId: ANDROID_ALERT_CHANNEL_ID,
            extra: payload.href ? { href: payload.href } : undefined,
          },
        ],
      });
    } catch {
      // Fallback: au moins le store Zustand a l’entrée
    }
    return;
  }

  if (typeof Notification === "undefined") {
    return;
  }
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
      requireInteraction: true,
    });
  } catch {
    // Silencieux
  }
}

export type ServerNotification = {
  id: string;
  title: string;
  body: string;
  tag: string;
  href?: string | null;
  data?: Record<string, unknown> | null;
  unread: boolean;
  created_at: string;
};

function mapServerNotification(row: ServerNotification): AppNotification {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tag: row.tag,
    href: row.href || undefined,
    createdAt: row.created_at,
    unread: row.unread,
  };
}

export async function listMyNotifications(limit = 100): Promise<AppNotification[]> {
  const response = await api.get<ServerNotification[]>("/api/v1/notifications", {
    params: { limit },
  });
  return response.data.map(mapServerNotification);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await api.post(`/api/v1/notifications/${notificationId}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/api/v1/notifications/mark-all-read");
}

export async function clearAllNotifications(): Promise<void> {
  await api.delete("/api/v1/notifications");
}
