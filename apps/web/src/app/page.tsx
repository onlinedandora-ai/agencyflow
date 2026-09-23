"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export default function HomePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    router.prefetch("/login");
    router.prefetch("/pipeline");

    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("agencyflow-auth") : null;
      const savedToken = raw ? JSON.parse(raw)?.state?.token : null;
      const target = token || savedToken ? "/pipeline" : "/login";
      router.replace(target);
    } catch {
      router.replace("/login");
    }
  }, [token, router]);

  return (
    <div className="mesh-page flex min-h-screen items-center justify-center" suppressHydrationWarning>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            try {
              var raw = localStorage.getItem("agencyflow-auth");
              var token = raw ? JSON.parse(raw)?.state?.token : null;
              window.location.replace(token ? "/pipeline" : "/login");
            } catch (e) {
              window.location.replace("/login");
            }
          `,
        }}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs font-medium tracking-wide text-muted-foreground">Opening AgencyFlow…</p>
      </div>
    </div>
  );
}
