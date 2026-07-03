importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA9QCi1-PQDs8z4lLJjbgQGkLzUdclAIyE",
  authDomain: "healthapp-462e7.firebaseapp.com",
  projectId: "healthapp-462e7",
  storageBucket: "healthapp-462e7.firebasestorage.app",
  messagingSenderId: "91061361654",
  appId: "1:91061361654:web:ae52b346cd74498025c5d7",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "GovCare EHR";
  const options = {
    body: payload.notification?.body || "New hospital notification",
    icon: "/ministry-health-logo.png",
    badge: "/ministry-health-logo.png",
    tag: payload.data?.tag || `govcare-${payload.data?.module || "ehr"}`,
    requireInteraction: payload.data?.priority === "critical" || payload.data?.priority === "urgent",
    data: {
      actionHref: payload.data?.actionHref || "/notifications",
      ...payload.data,
    },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const actionHref = event.notification.data?.actionHref || "/notifications";
  const targetUrl = new URL(actionHref, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existingClient) {
        existingClient.focus();
        return existingClient.navigate(targetUrl);
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
