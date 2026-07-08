"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export default function HomePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    router.replace(token ? "/pipeline" : "/login");
  }, [hasHydrated, token, router]);

  return (
    <div className="mesh-page flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading AgencyFlow…</p>
    </div>
  );
}
