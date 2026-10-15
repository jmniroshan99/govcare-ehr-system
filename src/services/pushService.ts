import type { GovCareNotification } from "../utils/notifications";

const PUSH_TOKEN_KEY = "govcare-local-push-token";

export async function registerPushNotifications() {
  if (!("Notification" in window)) throw new Error("This browser does not support notifications.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const token = `local-browser-notifications-${crypto.randomUUID()}`;
  window.localStorage.setItem(PUSH_TOKEN_KEY, token);
  return token;
}

export function getStoredPushToken() {
  return window.localStorage.getItem(PUSH_TOKEN_KEY);
}

export function notificationPermissionStatus() {
  if (!("Notification" in window)) return "unsupported" as const;
  return Notification.permission;
}

export async function showDesktopNotification(notification: Pick<GovCareNotification, "title" | "message" | "priority" | "actionHref" | "module">) {
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  const popup = new Notification(notification.title, {
    body: notification.message,
    icon: "/ministry-health-logo.png",
    tag: `govcare-${notification.module}-${notification.priority}`,
    requireInteraction: notification.priority === "critical" || notification.priority === "urgent",
    data: {
      actionHref: notification.actionHref ?? "/notifications",
      priority: notification.priority,
      module: notification.module,
    },
  });
  popup.onclick = () => {
    window.focus();
    if (notification.actionHref) window.location.assign(notification.actionHref);
    popup.close();
  };
  return true;
}

export async function watchForegroundPushMessages(_onPopup?: (title: string) => void) {
  return () => undefined;
}
