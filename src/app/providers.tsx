import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { MotionConfig } from "framer-motion";
import i18n from "../i18n";
import { ToastProvider } from "../components/ui/toast";
import { DATA_MUTATED_EVENT } from "../services/apiClient";
import { AUTHORIZATION_CHANGED_EVENT } from "../utils/browserClinicalCache";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Role views must converge with the API after another role writes.
            staleTime: 0,
            gcTime: 1000 * 60 * 60 * 24,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            networkMode: "online",
            retry: 1,
            refetchInterval: 30_000,
          },
        },
      }),
  );

  useEffect(() => {
    const onMutation = () => {
      // Invalidate all derived queries. Backend role/hospital scoping remains
      // authoritative; this only refreshes data already visible to the user.
      void queryClient.invalidateQueries();
    };
    const onAuthorizationChange = () => {
      void queryClient.cancelQueries();
      queryClient.clear();
    };
    window.addEventListener(DATA_MUTATED_EVENT, onMutation);
    window.addEventListener(AUTHORIZATION_CHANGED_EVENT, onAuthorizationChange);
    return () => {
      window.removeEventListener(DATA_MUTATED_EVENT, onMutation);
      window.removeEventListener(AUTHORIZATION_CHANGED_EVENT, onAuthorizationChange);
    };
  }, [queryClient]);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user"><ToastProvider>{children}</ToastProvider></MotionConfig>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
