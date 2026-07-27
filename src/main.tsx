import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AppProviders } from "./app/providers.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { initializeTheme } from "./hooks/useTheme.ts";
import { registerOfflineSynchronization } from "./services/offlineQueue.ts";
import { scheduleAfterFirstPaint } from "./utils/schedule.ts";

initializeTheme();

// Legacy cloud service workers and caches were intentionally removed. On first load,
// unregister old workers and delete GovCare/Firebase/Workbox/Vite cache entries, then
// use the PostgreSQL API as the authoritative data source.
scheduleAfterFirstPaint(() => {
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
  }
  if ("caches" in window) {
    void caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => /govcare|firebase|firestore|workbox|vite/i.test(key)).map((key) => caches.delete(key))));
  }
  registerOfflineSynchronization();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
);
