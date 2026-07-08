"use client";

import { cn } from "@/lib/utils";

export type StageOption = {
  id: string;
  label: string;
  count: number;
};

/** Zoho-style stage filter: proportional 2-up grid, no horizontal scroll. */
export function StageChipBar({
  stages,
  activeId,
  onChange,
}: {
  stages: StageOption[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="stage-chip-grid" role="tablist" aria-label="Board stages">
      {stages.map((stage) => {
        const active = activeId === stage.id;
        return (
          <button
            key={stage.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(stage.id)}
            className={cn(
              "stage-chip",
              active && "stage-chip-active",
            )}
          >
            <span className="line-clamp-2 w-full leading-tight">{stage.label}</span>
            <span className={cn("mt-1 text-[11px] font-semibold tabular-nums", active ? "text-indigo-700" : "text-muted-foreground")}>
              {stage.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function MobileStageSelect({
  value,
  options,
  onChange,
  label = "Move to",
}: {
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
  label?: string;
}) {
  return (
    <label className="mt-3 block text-xs text-muted-foreground">
      <span className="mb-1 block font-medium">{label}</span>
      <select
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          onChange(e.target.value);
        }}
        className="w-full rounded-lg border border-white/60 bg-white/50 px-3 py-2 text-sm"
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
