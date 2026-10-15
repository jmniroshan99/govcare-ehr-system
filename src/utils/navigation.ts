export interface SavedDetail {
  title?: string;
  summary?: string;
  module?: string;
}

const SAVED_DETAILS_KEY = "govcare-recent-saved-details";

export function getRecentSavedDetails() {
  try {
    return JSON.parse(window.localStorage.getItem(SAVED_DETAILS_KEY) ?? "[]") as Array<Required<SavedDetail> & { id: string; savedAt: string; path: string }>;
  } catch {
    return [];
  }
}

export function recordSavedDetail(detail: SavedDetail = {}) {
  const currentTitle = document.querySelector("h1")?.textContent?.trim() || "Saved change";
  const item = {
    id: `${Date.now()}`,
    title: detail.title || currentTitle,
    summary: detail.summary || "Saved successfully.",
    module: detail.module || currentTitle,
    savedAt: new Date().toLocaleString(),
    path: window.location.pathname,
  };
  const next = [item, ...getRecentSavedDetails()].slice(0, 8);
  window.localStorage.setItem(SAVED_DETAILS_KEY, JSON.stringify(next));
}

export function refreshAndRedirectToMainMenu(delayMs = 800, detail?: SavedDetail | null, targetPath = "/") {
  if (detail !== null) recordSavedDetail(detail);
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent("govcare:saved-details-updated"));
    window.dispatchEvent(new CustomEvent("govcare:redirect-main-menu", { detail: { targetPath } }));
    window.setTimeout(() => {
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, "", targetPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }, 120);
  }, delayMs);
}
