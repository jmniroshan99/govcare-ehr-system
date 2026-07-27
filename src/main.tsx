import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppProviders } from './app/providers.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initializeTheme } from './hooks/useTheme.ts'
import { registerOfflineSynchronization } from './services/offlineQueue.ts'
import { scheduleAfterFirstPaint } from './utils/schedule.ts'

initializeTheme()

scheduleAfterFirstPaint(() => {
  if (import.meta.env.DEV) {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
    }
    if ("caches" in window) {
      void caches.keys()
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith("govcare-")).map((key) => caches.delete(key))));
    }
    registerOfflineSynchronization();
    return;
  }

  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js").then((registration) => registration.update());
  }
  registerOfflineSynchronization();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
