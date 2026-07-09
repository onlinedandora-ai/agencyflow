"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { warmupApi } from "@/lib/api-warmup";
import { defaultQueryOptions } from "@/lib/query-config";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: defaultQueryOptions,
        },
      }),
  );

  useEffect(() => {
    warmupApi();

    const markHydrated = () => useAuthStore.setState({ _hasHydrated: true });
    const unsub = useAuthStore.persist.onFinishHydration(markHydrated);
    void useAuthStore.persist.rehydrate();

    const fallback = window.setTimeout(() => {
      if (!useAuthStore.getState()._hasHydrated) {
        markHydrated();
      }
    }, 2_000);

    return () => {
      unsub();
      clearTimeout(fallback);
    };
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
