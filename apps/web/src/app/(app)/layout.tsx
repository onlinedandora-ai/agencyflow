"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayoutSkeleton } from "@/components/loading-skeletons";
import { QuerySlowBanner } from "@/components/query-load-state";
import { useAuthStore } from "@/lib/auth-store";
import { AppShell } from "@/components/app-shell";
import { warmupApi } from "@/lib/api-warmup";
import { SLOW_QUERY_MS } from "@/lib/query-config";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [slowHydration, setSlowHydration] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    warmupApi();
    if (!token) {
      router.replace("/login");
    }
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (hasHydrated) {
      setSlowHydration(false);
      return;
    }
    const timer = window.setTimeout(() => setSlowHydration(true), SLOW_QUERY_MS);
    return () => window.clearTimeout(timer);
  }, [hasHydrated]);

  if (!hasHydrated || !token) {
    return (
      <div className="relative">
        <AppLayoutSkeleton />
        {slowHydration && !hasHydrated && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center px-4">
            <div className="pointer-events-auto w-full max-w-lg">
              <QuerySlowBanner message="Restoring your session…" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
