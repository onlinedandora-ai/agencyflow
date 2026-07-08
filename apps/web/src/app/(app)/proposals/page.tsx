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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {proposals.map((proposal) => (
            <Link
              key={proposal.id}
              href={`/proposals/${proposal.leadId}`}
              className="glass-panel p-5 transition hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{proposal.lead?.name || "Lead"}</h2>
                  <p className="text-xs text-muted-foreground">{proposal.lead?.company}</p>
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

              <div className="mt-4 flex flex-wrap gap-3 text-xs">
                <span className={cn(proposal.overWordLimit && "text-amber-600")}>
                  {proposal.wordCount}/{proposal.wordLimit} words
                  {proposal.overWordLimit && " ⚠"}
                </span>
                {proposal.sentAt && (
                  <span className={cn("flex items-center gap-1", proposal.followUpOverdue ? "text-destructive" : "text-muted-foreground")}>
                    <Clock className="h-3.5 w-3.5" />
                    {proposal.followUpOverdue
                      ? "24h follow-up overdue"
                      : `${proposal.followUpHoursRemaining}h until follow-up due`}
                  </span>
                )}
                <span className="text-primary">View preview →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
