"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppLayoutSkeleton } from "@/components/loading-skeletons";
import { useAuthStore } from "@/lib/auth-store";
import { AppShell } from "@/components/app-shell";
import { warmupApi } from "@/lib/api-warmup";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    warmupApi();
    if (!token) {
      router.replace("/login");
    }
  }, [hasHydrated, token, router]);

  if (!hasHydrated || !token) {
    return <AppLayoutSkeleton />;
  }

  return <AppShell>{children}</AppShell>;
}
