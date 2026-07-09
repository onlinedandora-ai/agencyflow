"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
