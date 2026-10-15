import { useSyncExternalStore } from "react";
import { getServerThemeSnapshot, getThemeSnapshot, setTheme, subscribeTheme } from "../theme/themeStore";
export { applyTheme, initializeTheme } from "../theme/themeStore";

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  return { theme, isDark: theme === "dark", setTheme, toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark") };
}
