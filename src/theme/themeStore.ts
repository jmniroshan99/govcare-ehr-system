import type { Theme } from "./colors";

const storageKey = "govcare-theme";
const listeners = new Set<() => void>();
let current: Theme | undefined;
let initialized = false;

function savedTheme(): Theme | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === "light" || value === "dark" ? value : undefined;
  } catch { return undefined; }
}

function preferredTheme(): Theme {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getThemeSnapshot(): Theme { return current ?? savedTheme() ?? preferredTheme(); }
export function getServerThemeSnapshot(): Theme { return "light"; }
export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function applyTheme(theme: Theme) {
  current = theme;
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }
  listeners.forEach((listener) => listener());
}

export function setTheme(value: Theme | ((previous: Theme) => Theme)) {
  const theme = typeof value === "function" ? value(getThemeSnapshot()) : value;
  applyTheme(theme);
  try { window.localStorage.setItem(storageKey, theme); } catch { /* Theme still works when storage is unavailable. */ }
}

export function initializeTheme() {
  applyTheme(savedTheme() ?? preferredTheme());
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) applyTheme(savedTheme() ?? preferredTheme());
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!savedTheme()) applyTheme(preferredTheme());
  });
}
