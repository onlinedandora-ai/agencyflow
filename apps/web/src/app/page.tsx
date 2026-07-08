"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export default function HomePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    router.replace(token ? "/pipeline" : "/login");
  }, [ready, token, router]);

  return (
    <div className="mesh-page flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading AgencyFlow…</p>
    </div>
  );
}
