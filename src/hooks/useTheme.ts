import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const storageKey = "govcare-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(storageKey);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function initializeTheme() {
  applyTheme(getInitialTheme());
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => current === "dark" ? "light" : "dark");
  }

  return { theme, isDark: theme === "dark", setTheme, toggleTheme };
}
