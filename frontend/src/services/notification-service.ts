import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  PushNotifications,
  type PushNotificationActionPerformed,
  type PushNotificationSchema,
} from "@capacitor/push-notifications";

import { api } from "@/lib/api";
import { useNotificationStore, type AppNotification } from "@/store/notification-store";

const TOKEN_STORAGE_KEY = "amazer_notification_token_registered";
const ANDROID_ALERT_CHANNEL_ID = "amazer-alerts";
const NATIVE_ALERT_SOUND = "amazer_alert.wav";
/** Meme tonalite que l app native, servie depuis /public pour le navigateur */
const WEB_ALERT_SOUND_URL = "/sounds/amazer-alert.wav";

const NOTIFICATION_SOUND_KEY = "amazer_notification_sound_enabled";

export function isNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(NOTIFICATION_SOUND_KEY) !== "false";
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIFICATION_SOUND_KEY, String(enabled));
}

async function playWebNotificationAlertSound(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  if (!isNotificationSoundEnabled()) {
    return;
  }
  try {
    const audio = new Audio(WEB_ALERT_SOUND_URL);
    audio.volume = 0.88;
    await audio.play();
    return;
  } catch {
    // Autoplay ou fichier indisponible : court bip de secours
  }
  try {
    type WinAudio = Window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext || (window as WinAudio).webkitAudioContext;
    if (!Ctx) {
      return;
    }
    const ctx = new Ctx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.22);
    oscillator.onended = () => void ctx.close();
  } catch {
    /* silencieux */
  }
}
const FCM_TOKEN_PREFIX = "fcm:";
const DELIVERED_TAGS_STORAGE_KEY = "amazer_delivered_notification_tags";
const DELIVERED_TAG_TTL_MS = 1000 * 60 * 60 * 12;
const ENABLE_NATIVE_PUSH = process.env.NEXT_PUBLIC_ENABLE_NATIVE_PUSH === "true";

export const AMAZER_NOTIFICATION_EVENT = "amazer:notification-received";

let nativeNotificationReady: Promise<boolean> | null = null;
let nativePushListenersAttached = false;

type LocalAlertPayload = {
  title: string;
  body: string;
  tag: string;
  href?: string;
};

function dispatchNotificationEvent(payload: LocalAlertPayload) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(AMAZER_NOTIFICATION_EVENT, {
      detail: payload,
    })
  );
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readDeliveredTags(): Record<string, number> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(DELIVERED_TAGS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeDeliveredTags(map: Record<string, number>) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(DELIVERED_TAGS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Silencieux
  }
}

function shouldSkipDeliveredNotification(tag: string): boolean {
  const now = Date.now();
  const delivered = readDeliveredTags();
  let dirty = false;
  for (const [key, timestamp] of Object.entries(delivered)) {
    if (!Number.isFinite(timestamp) || now - timestamp > DELIVERED_TAG_TTL_MS) {
      delete delivered[key];
      dirty = true;
    }
  }
  const lastDeliveredAt = delivered[tag];
  if (dirty) {
    writeDeliveredTags(delivered);
  }
  return Number.isFinite(lastDeliveredAt) && now - lastDeliveredAt < DELIVERED_TAG_TTL_MS;
}

function markDeliveredNotification(tag: string) {
  const delivered = readDeliveredTags();
  delivered[tag] = Date.now();
  writeDeliveredTags(delivered);
}

function mapPushNotificationPayload(notification: PushNotificationSchema): LocalAlertPayload {
  const data =
    notification.data && typeof notification.data === "object"
      ? (notification.data as Record<string, unknown>)
      : {};
  const title = notification.title?.trim() || safeString(data.title) || "Nouvelle notification";
  const body =
    notification.body?.trim() || safeString(data.body) || "Consultez votre espace AMAZER.";
  const href = safeString(data.href) || safeString(data.link);
  const tag =
    safeString(data.tag) ||
    safeString(notification.id) ||
    `push-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    title,
    body,
    tag,
    href,
  };
}

async function registerDeviceToken(deviceToken: string) {
  if (typeof window === "undefined") {
    return;
  }
  const normalizedToken = deviceToken.trim();
  if (!normalizedToken || window.localStorage.getItem(TOKEN_STORAGE_KEY) === normalizedToken) {
    return;
  }
  await api.post("/api/v1/notifications/register-token", {
    device_token: normalizedToken,
  });
  window.localStorage.setItem(TOKEN_STORAGE_KEY, normalizedToken);
}

function attachNativePushListeners() {
  if (!Capacitor.isNativePlatform() || nativePushListenersAttached) {
    return;
  }
  nativePushListenersAttached = true;

  PushNotifications.addListener("registration", (token) => {
    void registerDeviceToken(`${FCM_TOKEN_PREFIX}${token.value}`);
  });

  PushNotifications.addListener("registrationError", () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  });

  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    const payload = mapPushNotificationPayload(notification);
    void notifyLocalOrderEvent(payload);
  });

  PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action: PushNotificationActionPerformed) => {
      const payload = mapPushNotificationPayload(action.notification);
      dispatchNotificationEvent(payload);
      if (typeof window !== "undefined" && payload.href) {
        window.location.assign(payload.href);
      }
    }
  );
}

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
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display === "granted" && Capacitor.getPlatform() === "android") {
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
      return permission.display === "granted";
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
    await ensureNativeNotificationChannel();
    if (!ENABLE_NATIVE_PUSH) {
      return;
    }
    try {
      attachNativePushListeners();
      const current = await PushNotifications.checkPermissions();
      let receive = current.receive;
      if (receive === "prompt") {
        const permission = await PushNotifications.requestPermissions();
        receive = permission.receive;
      }
      if (receive !== "granted") {
        return;
      }
      await PushNotifications.register();
    } catch {
      // Ne bloque pas l UX mobile si Firebase/FCM n'est pas pret.
      return;
    }
    return;
  }

  if (typeof Notification === "undefined") {
    return;
  }
  if (window.localStorage.getItem(TOKEN_STORAGE_KEY)) {
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

  try {
    await registerDeviceToken(`web:${navigator.userAgent}::${Math.random().toString(36).slice(2)}`);
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
  if (shouldSkipDeliveredNotification(payload.tag)) {
    return;
  }
  markDeliveredNotification(payload.tag);
  useNotificationStore.getState().pushNotification(payload);
  dispatchNotificationEvent(payload);

  if (!Capacitor.isNativePlatform()) {
    void playWebNotificationAlertSound();
  }

  if (Capacitor.isNativePlatform()) {
    const ok = await ensureNativeNotificationChannel();
    if (!ok) {
      return;
    }
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
      // Fallback: au moins le store Zustand conserve l entree.
    }
    return;
  }

  if (typeof Notification === "undefined") {
    return;
  }
  if (Notification.permission !== "granted") {
    return;
  }
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

export async function listMyNotifications(limit = 100, offset = 0): Promise<AppNotification[]> {
  const response = await api.get<ServerNotification[]>("/api/v1/notifications", {
    params: { limit, offset },
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
