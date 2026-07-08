"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function BillingRedirectPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/portal/${token}#billing`);
  }, [token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Redirecting to client portal...
    </div>
  );
}
