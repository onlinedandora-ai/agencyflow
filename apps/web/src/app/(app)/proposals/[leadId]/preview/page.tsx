"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy, Download, ExternalLink, Pencil } from "lucide-react";
import { ProposalDocument } from "@/components/proposal-document";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function ProposalPreviewPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const token = useAuthStore((s) => s.token)!;
  const queryClient = useQueryClient();

  const { data: proposal, isLoading } = useQuery({
    queryKey: ["proposal", leadId],
    queryFn: () => api.getProposalByLead(token, leadId),
  });

  const { data: agency } = useQuery({
    queryKey: ["agency"],
    queryFn: () => api.getAgencyProfile(token),
  });

  const acceptMutation = useMutation({
    mutationFn: () =>
      api.acceptProposal(token, leadId, {
        acceptedByName: proposal?.lead?.name || "Client",
        acceptedByEmail: proposal?.lead?.email || "client@example.com",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal", leadId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  if (isLoading || !proposal || !agency) {
    return <p className="text-sm text-[var(--color-muted)]">Loading preview...</p>;
  }

  const hasContent = [
    proposal.situation,
    proposal.recommendation,
    proposal.deliverables,
    proposal.timeline,
    proposal.investment,
    proposal.nextStep,
  ].some((s) => s?.trim());

  const clientUrl = proposal.publicToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${proposal.publicToken}`
    : null;

  return (
    <div className="space-y-6">
      <div className="no-print mx-auto flex max-w-[800px] flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/proposals/${leadId}`} className="text-[var(--color-muted)] hover:text-[var(--color-primary)]">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Final Proposal</h1>
            <p className="text-sm text-[var(--color-muted)]">
              {proposal.proposalNumber || "Draft"} · Client-facing document
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/proposals/${leadId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          {clientUrl && (
            <>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(clientUrl)}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              >
                <Copy className="h-4 w-4" />
                Copy client link
              </button>
              <a
                href={clientUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              >
                <ExternalLink className="h-4 w-4" />
                Client view
              </a>
            </>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"
          >
            <Download className="h-4 w-4" />
            Print / PDF
          </button>
        </div>
      </div>

      {clientUrl && (
        <p className="no-print mx-auto max-w-[800px] rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-[var(--color-ink)]">
          <strong>Accept flow:</strong> Send the client link above. When they click{" "}
          <strong>Accept Proposal</strong>, acceptance is recorded (name, email, timestamp), the lead
          moves to Closed Won, a client workspace is created, and the advance invoice is raised.
          Payment is confirmed separately on the <Link href="/clients" className="text-[var(--color-primary)]">Clients</Link> page.
        </p>
      )}

      {!hasContent ? (
        <div className="no-print mx-auto max-w-[800px] rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">This proposal is empty. Fill in the builder first.</p>
          <Link href={`/proposals/${leadId}`} className="mt-4 inline-block text-sm text-[var(--color-primary)]">
            Open proposal builder →
          </Link>
        </div>
      ) : (
        <div className="proposal-print-area pb-10">
          <ProposalDocument proposal={proposal} agency={agency} caseStudy={proposal.caseStudy} mode="preview" />
        </div>
      )}
    </div>
  );
}
