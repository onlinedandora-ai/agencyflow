"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Clock, FileCheck, Lock, Unlock } from "lucide-react";
import { api, cn } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function IntakeBadge({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        done ? "bg-green-50 text-green-700" : "bg-slate-100 text-muted-foreground",
      )}
    >
      {done ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {label}
    </span>
  );
}

export default function ClientsPage() {
  const token = useAuthStore((s) => s.token)!;
  const queryClient = useQueryClient();
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.getWorkspaces(token),
  });

  const { data: pendingClaims = [] } = useQuery({
    queryKey: ["payment-claims", "PENDING"],
    queryFn: () => api.getPaymentClaims(token, "PENDING"),
  });

  const approveMutation = useMutation({
    mutationFn: (claimId: string) => api.approvePaymentClaim(token, claimId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-claims"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ claimId, note }: { claimId: string; note: string }) =>
      api.rejectPaymentClaim(token, claimId, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payment-claims"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Client Workspaces</h1>
        <p className="text-sm text-muted-foreground">
          SOP onboarding intake, brand assets, access &amp; bank-transfer payment validation
        </p>
      </div>

      {pendingClaims.length > 0 && (
        <div className="glass-panel border-amber-200/70 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-amber-900">
            <FileCheck className="h-5 w-5" />
            Pending payment confirmations ({pendingClaims.length})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review client-submitted payment screenshots, then approve to issue receipt and unlock work.
          </p>
          <div className="mt-4 space-y-4">
            {pendingClaims.map((claim) => (
              <article key={claim.id} className="rounded-xl border border-white/50 bg-white/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {claim.invoice.workspace.company || claim.invoice.workspace.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {claim.invoice.number}
                      {claim.milestone?.label ? ` · ${claim.milestone.label}` : ""} · ₹
                      {Number(claim.amount).toLocaleString("en-IN")} · {claim.paymentMode}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submitted by {claim.submittedByName} on{" "}
                      {new Date(claim.submittedAt).toLocaleString("en-IN")}
                      {claim.paymentReference ? ` · Ref: ${claim.paymentReference}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(claim.id)}
                      disabled={approveMutation.isPending}
                    >
                      Validate &amp; issue receipt
                    </Button>
                  </div>
                </div>
                {claim.proofDataUrl && (
                  <a href={claim.proofDataUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary">
                    View payment screenshot →
                  </a>
                )}
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Input
                    className="max-w-xs text-sm"
                    placeholder="Rejection reason (if declining)"
                    value={rejectNote[claim.id] ?? ""}
                    onChange={(e) => setRejectNote((n) => ({ ...n, [claim.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      rejectMutation.mutate({ claimId: claim.id, note: rejectNote[claim.id] ?? "" })
                    }
                    disabled={!rejectNote[claim.id]?.trim() || rejectMutation.isPending}
                  >
                    Reject
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

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
            const portalUrl =
              typeof window !== "undefined"
                ? `${window.location.origin}/portal/${ws.billingToken}`
                : `/portal/${ws.billingToken}`;

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
                    <div className="mt-3 flex flex-wrap gap-2">
                      <IntakeBadge done={!!ws.onboardingIntakeAt} label="Onboarding" />
                      <IntakeBadge done={!!ws.brandIntakeAt} label="Brand assets" />
                      <IntakeBadge done={!!ws.accessIntakeAt} label="Access & social" />
                    </div>
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
                    {project && (
                      <Link
                        href={`/projects/${project.id}/board`}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:border-[var(--color-primary)]"
                      >
                        Open task board →
                      </Link>
                    )}
                  </div>
                )}

                {ws.billingToken && (
                  <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 text-sm">
                    <p className="font-medium text-primary">Client portal link</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Onboarding forms, brand/asset links, social access &amp; payment confirmation
                    </p>
                    <p className="mt-1 break-all font-mono text-xs">{portalUrl}</p>
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
