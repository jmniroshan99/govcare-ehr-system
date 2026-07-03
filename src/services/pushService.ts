import { getToken, onMessage } from "firebase/messaging";
import { messagingPromise } from "../lib/firebase";
import type { GovCareNotification } from "../utils/notifications";

const FCM_TOKEN_KEY = "govcare-fcm-token";

export async function registerPushNotifications() {
  if (!("Notification" in window)) throw new Error("This browser does not support notifications.");
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error("Firebase Web Push certificate key is missing.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/firebase-cloud-messaging-push-scope" });
  const messaging = await messagingPromise;
  if (!messaging) throw new Error("Firebase Messaging is not supported in this browser.");
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  window.localStorage.setItem(FCM_TOKEN_KEY, token);
  return token;
}

export function getStoredPushToken() {
  return window.localStorage.getItem(FCM_TOKEN_KEY);
}

export function notificationPermissionStatus() {
  if (!("Notification" in window)) return "unsupported" as const;
  return Notification.permission;
}

export async function showDesktopNotification(notification: Pick<GovCareNotification, "title" | "message" | "priority" | "actionHref" | "module">) {
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  const options: NotificationOptions = {
    body: notification.message,
    icon: "/ministry-health-logo.png",
    badge: "/ministry-health-logo.png",
    tag: `govcare-${notification.module}-${notification.priority}`,
    requireInteraction: notification.priority === "critical" || notification.priority === "urgent",
    data: {
      actionHref: notification.actionHref ?? "/notifications",
      priority: notification.priority,
      module: notification.module,
    },
  };
  if (registration?.showNotification) {
    await registration.showNotification(notification.title, options);
    return true;
  }
  const popup = new Notification(notification.title, options);
  popup.onclick = () => {
    window.focus();
    if (notification.actionHref) window.location.assign(notification.actionHref);
    popup.close();
  };
  return true;
}

export async function watchForegroundPushMessages(onPopup?: (title: string) => void) {
  const messaging = await messagingPromise;
  if (!messaging) return () => undefined;
  return onMessage(messaging, async (payload) => {
    const title = payload.notification?.title || payload.data?.title || "GovCare EHR";
    const message = payload.notification?.body || payload.data?.message || "New hospital notification";
    await showDesktopNotification({
      title,
      message,
      module: payload.data?.module || "GovCare",
      priority: (payload.data?.priority as GovCareNotification["priority"]) || "information",
      actionHref: payload.data?.actionHref || "/notifications",
    });
    onPopup?.(title);
  });
}
