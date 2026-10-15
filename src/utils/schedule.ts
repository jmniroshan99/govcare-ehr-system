export function scheduleAfterFirstPaint(task: () => void, timeout = 1600) {
  if (typeof window === "undefined") return;
  const run = () => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => task(), { timeout });
      return;
    }
    window.setTimeout(task, 250);
  };
  window.setTimeout(run, 0);
}
