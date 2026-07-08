"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { AppShell } from "@/components/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
    }
  }, [hasHydrated, token, router]);

  if (!hasHydrated || !token) {
    return (
      <div className="mesh-page flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading AgencyFlow…</p>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
