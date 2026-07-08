"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, cn, type WorkspaceSearchResult } from "@/lib/api";
import { Input } from "@/components/ui/input";

type WorkspaceSearchComboboxProps = {
  token: string;
  value: WorkspaceSearchResult | null;
  onChange: (workspace: WorkspaceSearchResult | null) => void;
  disabled?: boolean;
};

export function WorkspaceSearchCombobox({
  token,
  value,
  onChange,
  disabled,
}: WorkspaceSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["workspace-search", query],
    queryFn: () => api.searchWorkspaces(token, query),
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(workspace: WorkspaceSearchResult) {
    onChange(workspace);
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setOpen(true);
  }

  return (
    <div ref={containerRef} className="relative">
      {value && !open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={handleClear}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border bg-white/50 px-3 py-2 text-left text-sm",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <span className="min-w-0 truncate">
            <span className="font-medium">{value.name}</span>
            {(value.company || value.email) && (
              <span className="text-muted-foreground">
                {" "}
                · {value.company || value.email}
              </span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search by name, company, or email…"
            className="pl-9"
            disabled={disabled}
            autoFocus={open}
          />
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-popover shadow-md">
          {isFetching && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No clients found</p>
          ) : (
            results.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                onClick={() => handleSelect(workspace)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60",
                  value?.id === workspace.id && "bg-muted/40",
                )}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    value?.id === workspace.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{workspace.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[workspace.company, workspace.email].filter(Boolean).join(" · ") ||
                      "No company or email"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
