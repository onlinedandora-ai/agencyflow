"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, Clock, FileText } from "lucide-react";
import { api, cn } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function ProposalsPage() {
  const token = useAuthStore((s) => s.token)!;

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["proposals"],
    queryFn: () => api.getProposals(token),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Proposals</h1>
        <p className="text-sm text-muted-foreground">6-section template with 300-word guardrail and 24h follow-up timer</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading proposals...</p>
      ) : proposals.length === 0 ? (
        <div className="glass-panel border-dashed p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No proposals yet. Open a lead from the pipeline to start one.</p>
          <Link href="/pipeline" className="mt-4 inline-block text-sm text-primary">
            Go to pipeline →
          </Link>
        </div>
      ) : (
        <div className="card-grid-2 xl:grid-cols-3">
          {proposals.map((proposal) => (
            <Link
              key={proposal.id}
              href={`/proposals/${proposal.leadId}`}
              className="catalog-card transition hover:border-primary/30"
            >
              <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">{proposal.lead?.name || "Lead"}</h2>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{proposal.lead?.company}</p>
                </div>
                {proposal.status === "REVISION_REQUESTED" ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                    Revision requested
                  </span>
                ) : proposal.sentAt ? (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">
                    Sent{(proposal.currentVersion ?? 0) > 0 ? ` v${proposal.currentVersion}` : ""}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">Draft</span>
                )}
              </div>

              <div className="mt-auto flex flex-col gap-2 pt-3 text-xs">
                <span className={cn(proposal.overWordLimit && "text-amber-600")}>
                  {proposal.wordCount}/{proposal.wordLimit} words
                  {proposal.overWordLimit && " ⚠"}
                </span>
                {proposal.sentAt && (
                  <span className={cn("flex items-center gap-1", proposal.followUpOverdue ? "text-destructive" : "text-muted-foreground")}>
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">
                      {proposal.followUpOverdue
                        ? "24h follow-up overdue"
                        : `${proposal.followUpHoursRemaining}h until follow-up`}
                    </span>
                  </span>
                )}
                <span className="font-medium text-primary">View →</span>
              </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
