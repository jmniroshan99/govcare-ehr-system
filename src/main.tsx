import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppProviders } from './app/providers.tsx'
import { initializeTheme } from './hooks/useTheme.ts'
import { registerOfflineSynchronization } from './services/offlineQueue.ts'

initializeTheme()

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").then((registration) => registration.update());
  });
}

registerOfflineSynchronization()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
)
