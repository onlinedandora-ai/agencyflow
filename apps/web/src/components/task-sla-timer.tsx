"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { formatSlaCountdown, getSlaTimerClass, type TaskSla } from "@/lib/task-utils";
import { cn } from "@/lib/utils";

type TaskSlaTimerProps = {
  sla?: TaskSla | null;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
};

export function TaskSlaTimer({ sla, compact = false, showLabel = true, className }: TaskSlaTimerProps) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!sla?.active) return;
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [sla?.active]);

  if (!sla || !sla.active || sla.completed) return null;

  const label = formatSlaCountdown(sla);
  if (!label) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        compact ? "text-[10px]" : "text-xs",
        getSlaTimerClass(sla),
        className,
      )}
    >
      {sla.breached ? (
        <AlertTriangle className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5", "shrink-0")} />
      ) : (
        <Clock className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5", "shrink-0")} />
      )}
      <span className="truncate">
        {label}
        {showLabel && ` · SOP ${sla.targetHours}h`}
      </span>
    </div>
  );
}
