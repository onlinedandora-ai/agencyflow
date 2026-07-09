"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { warmupApi } from "@/lib/api-warmup";
import { LIST_STALE_TIME } from "@/lib/query-config";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: LIST_STALE_TIME,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    warmupApi();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
