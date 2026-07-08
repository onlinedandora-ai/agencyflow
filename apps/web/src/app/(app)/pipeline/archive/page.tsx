"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArchiveRestore, ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, type Lead } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { canManageTasks } from "@/lib/task-utils";
import { Button } from "@/components/ui/button";

export default function PipelineArchivePage() {
  const token = useAuthStore((s) => s.token)!;
  const user = useAuthStore((s) => s.user);
  const isManager = canManageTasks(user?.role);
  const queryClient = useQueryClient();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads-archive"],
    queryFn: () => api.getArchivedLeads(token),
    enabled: isManager,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.restoreLead(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-archive"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-stats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteLead(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-archive"] });
      setConfirmDeleteId(null);
    },
  });

  if (!isManager) {
    return (
      <div className="glass-panel p-6">
        <h1 className="page-title">Archive</h1>
        <p className="mt-2 text-sm text-muted-foreground">Only admins and client managers can view the lead archive.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="page-header">
        <div className="min-w-0">
          <Link href="/pipeline" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Back to pipeline
          </Link>
          <h1 className="page-title">Archived leads</h1>
          <p className="text-sm text-muted-foreground">
            Restore contacts to the pipeline or permanently delete them here.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading archive…</p>
      ) : leads.length === 0 ? (
        <div className="glass-panel border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No archived leads. Archive a contact from the pipeline when you want to remove them from active view.</p>
          <Link href="/pipeline" className="mt-4 inline-block text-sm text-primary">
            Go to pipeline →
          </Link>
        </div>
      ) : (
        <div className="mobile-stack">
          {leads.map((lead: Lead) => (
            <article key={lead.id} className="stack-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-semibold">{lead.name}</h2>
                  <p className="text-sm text-muted-foreground">{lead.company || "No company"}</p>
                  {lead.email && <p className="mt-1 text-xs text-muted-foreground">{lead.email}</p>}
                  {lead.archivedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Archived {new Date(lead.archivedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => restoreMutation.mutate(lead.id)}
                    disabled={restoreMutation.isPending}
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                  {confirmDeleteId === lead.id ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMutation.mutate(lead.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Confirm delete
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => setConfirmDeleteId(lead.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
