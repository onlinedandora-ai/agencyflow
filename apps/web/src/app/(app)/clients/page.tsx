"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Lock, Unlock } from "lucide-react";
import { api, cn } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function ClientsPage() {
  const token = useAuthStore((s) => s.token)!;
  const queryClient = useQueryClient();

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.getWorkspaces(token),
  });

  const payMutation = useMutation({
    mutationFn: (invoiceId: string) => api.confirmAdvancePayment(token, invoiceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Client Workspaces</h1>
        <p className="text-sm text-muted-foreground">
          Onboarding with advance-payment gate — work unlocks after payment confirmed
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading workspaces...</p>
      ) : workspaces.length === 0 ? (
        <div className="glass-panel border-dashed p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No client workspaces yet. Convert a lead in Negotiation or Won stage from the pipeline.
          </p>
          <Link href="/pipeline" className="mt-4 inline-block text-sm text-primary">
            Go to pipeline →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {workspaces.map((ws) => {
            const project = ws.projects[0];
            const advanceInvoice = ws.invoices.find((inv) => inv.isAdvance);
            const isLocked = project?.status === "AWAITING_ADVANCE";

            return (
              <article
                key={ws.id}
                className={cn(
                  "glass-panel p-5",
                  isLocked ? "border-amber-200 bg-amber-50/30" : "border-[var(--color-border)]",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{ws.name}</h2>
                    <p className="text-sm text-muted-foreground">{ws.company}</p>
                    {project && (
                      <p className="mt-2 text-sm">
                        Project: <strong>{project.name}</strong> — {project.status.replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {isLocked ? (
                      <>
                        <Lock className="h-4 w-4 text-amber-600" />
                        <span className="text-amber-600">Awaiting advance</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="h-4 w-4 text-green-600" />
                        <span className="text-green-600">Gate cleared</span>
                      </>
                    )}
                  </div>
                </div>

                {advanceInvoice && (
                  <div className="glass-panel mt-4 flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                    <div>
                      <p className="font-medium">{advanceInvoice.number}</p>
                      <p className="text-muted-foreground">
                        Advance: ₹{Number(advanceInvoice.amount).toLocaleString()} — {advanceInvoice.status}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {advanceInvoice.status !== "PAID" && (
                        <button
                          onClick={() => payMutation.mutate(advanceInvoice.id)}
                          disabled={payMutation.isPending}
                          className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Confirm payment (demo)
                        </button>
                      )}
                      {project && (
                        <Link
                          href={`/projects/${project.id}/board`}
                          className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:border-[var(--color-primary)]"
                        >
                          Open task board →
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {ws.billingToken && (
                  <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 text-sm">
                    <p className="font-medium text-primary">Client billing link</p>
                    <p className="mt-1 break-all font-mono text-xs">
                      {typeof window !== "undefined" ? `${window.location.origin}/billing/${ws.billingToken}` : `/billing/${ws.billingToken}`}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
