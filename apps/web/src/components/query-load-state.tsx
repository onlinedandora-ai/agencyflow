"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SLOW_QUERY_MS } from "@/lib/query-config";
import { cn } from "@/lib/utils";

export function useSlowQuery(active: boolean) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), SLOW_QUERY_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  return slow;
}

function formatQueryError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong while loading data.";
}

export function QuerySlowBanner({ message = "Waking up API…" }: { message?: string }) {
  return (
    <Alert>
      <Loader2 className="h-4 w-4 animate-spin" />
      <AlertDescription>{message} This can take up to 30 seconds on the free tier.</AlertDescription>
    </Alert>
  );
}

export function QueryErrorBanner({
  error,
  onRetry,
  retrying = false,
}: {
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{formatQueryError(error)}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          <RefreshCw className={cn("h-4 w-4", retrying && "animate-spin")} />
          {retrying ? "Retrying…" : "Retry"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
