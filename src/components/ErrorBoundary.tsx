import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryState {
  error?: Error;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("GovCare UI render failed.", error, info);
    const dynamicImportFailed = error.message.includes("Failed to fetch dynamically imported module")
      || error.message.includes("Importing a module script failed")
      || error.message.includes("error loading dynamically imported module");
    if (dynamicImportFailed) void recoverFromStaleDevBundle();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-surface p-5 text-foreground">
        <section className="w-full max-w-lg rounded-lg border border-danger-border bg-surface p-6 shadow-xl">
          <p className="text-sm font-bold uppercase tracking-wide text-danger">GovCare interface recovery</p>
          <h1 className="mt-2 text-2xl font-bold">The page could not open safely.</h1>
          <p className="mt-3 text-sm text-foreground">
            The interface received an unexpected module or data format. Reload the app to clear stale browser data, or open Login and sign in again.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-md bg-danger-surface p-3 text-xs text-danger">
            {this.state.error.message}
          </pre>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent-solid px-4 text-sm font-bold text-on-solid" type="button" onClick={() => void recoverFromStaleDevBundle(true)}>
              Reload app
            </button>
            <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-bold text-foreground" href="/login">
              Open login
            </a>
          </div>
        </section>
      </main>
    );
  }
}

async function recoverFromStaleDevBundle(force = false) {
  if (typeof window === "undefined") return;
  const key = "govcare-dynamic-import-recovery";
  const alreadyTried = window.sessionStorage.getItem(key);
  if (alreadyTried && !force) return;
  window.sessionStorage.setItem(key, new Date().toISOString());
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.filter((name) => /govcare|firebase|firestore|workbox|vite/i.test(name)).map((name) => caches.delete(name)));
    }
  } catch (error) {
    console.warn("GovCare cache recovery could not fully clear local browser cache.", error);
  }
  const target = window.location.pathname === "/doctor" ? "/login" : window.location.pathname;
  window.location.replace(`${target}?recovered=${Date.now()}`);
}
