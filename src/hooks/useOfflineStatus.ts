import { useCallback, useEffect, useState } from "react";
import { getOfflineActionCount, OFFLINE_QUEUE_UPDATED, OFFLINE_SYNC_COMPLETED, syncOfflineActions } from "../services/offlineQueue";

export function useOfflineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshQueueCount = useCallback(() => {
    void getOfflineActionCount().then(setQueued);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      refreshQueueCount();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(OFFLINE_QUEUE_UPDATED, refreshQueueCount);
    window.addEventListener(OFFLINE_SYNC_COMPLETED, refreshQueueCount);
    refreshQueueCount();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_UPDATED, refreshQueueCount);
      window.removeEventListener(OFFLINE_SYNC_COMPLETED, refreshQueueCount);
    };
  }, [refreshQueueCount]);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      await syncOfflineActions();
      refreshQueueCount();
    } finally {
      setSyncing(false);
    }
  }, [refreshQueueCount]);

  return { online, queued, syncing, syncNow };
}
