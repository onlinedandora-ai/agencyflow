"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { ProposalDocument } from "@/components/proposal-document";
import { api } from "@/lib/api";

export default function PublicProposalPage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionComments, setRevisionComments] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [revisionSubmitted, setRevisionSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-proposal", token],
    queryFn: () => api.getPublicProposal(token),
  });

  const acceptMutation = useMutation({
    mutationFn: () => api.acceptPublicProposal(token, { acceptedByName: name, acceptedByEmail: email }),
    onSuccess: () => {
      setAccepted(true);
      setShowAcceptForm(false);
      queryClient.invalidateQueries({ queryKey: ["public-proposal", token] });
    },
  });

  const revisionMutation = useMutation({
    mutationFn: () =>
      api.requestProposalRevision(token, {
        requestedByName: name,
        requestedByEmail: email || undefined,
        comments: revisionComments,
      }),
    onSuccess: () => {
      setRevisionSubmitted(true);
      setShowRevisionForm(false);
      queryClient.invalidateQueries({ queryKey: ["public-proposal", token] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <p className="text-sm text-[var(--color-muted)]">Loading proposal...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <p className="text-sm text-[var(--color-danger)]">Proposal not found or link expired.</p>
      </div>
    );
  }

  const { agency, ...proposal } = data;
  const isAccepted = proposal.status === "ACCEPTED" || accepted;
  const hasPendingRevision =
    proposal.status === "REVISION_REQUESTED" || revisionSubmitted;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] py-10">
      <div className="mx-auto max-w-[800px] px-4">
        {revisionSubmitted && (
          <div className="no-print mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Your revision request has been submitted. We&apos;ll update the proposal and send you an
            updated link shortly.
          </div>
        )}

        {showAcceptForm && !isAccepted && (
          <div className="no-print mb-6 rounded-xl border border-[var(--color-border)] bg-white p-6">
            <h2 className="text-lg font-semibold">Confirm acceptance</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Enter your details to digitally accept this proposal.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="Your email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => acceptMutation.mutate()}
                disabled={!name || !email || acceptMutation.isPending}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {acceptMutation.isPending ? "Processing..." : "Confirm acceptance"}
              </button>
              <button
                type="button"
                onClick={() => setShowAcceptForm(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showRevisionForm && !isAccepted && !hasPendingRevision && (
          <div className="no-print mb-6 rounded-xl border border-amber-200 bg-amber-50/50 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MessageSquare className="h-5 w-5 text-amber-700" />
              Request changes
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Tell us what you&apos;d like revised. We&apos;ll update the proposal and resend an updated
              link.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border bg-white px-3 py-2 text-sm"
              />
              <input
                placeholder="Your email (optional)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <textarea
              placeholder="Describe the changes you'd like..."
              value={revisionComments}
              onChange={(e) => setRevisionComments(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-lg border bg-white px-3 py-2 text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => revisionMutation.mutate()}
                disabled={!name || !revisionComments.trim() || revisionMutation.isPending}
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {revisionMutation.isPending ? "Submitting..." : "Submit revision request"}
              </button>
              <button
                type="button"
                onClick={() => setShowRevisionForm(false)}
                className="rounded-lg border bg-white px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <ProposalDocument
          proposal={proposal}
          agency={agency}
          caseStudy={proposal.caseStudy}
          mode="client"
          acceptDisabled={isAccepted || hasPendingRevision}
          acceptLoading={acceptMutation.isPending}
          onAccept={() => {
            setName(proposal.lead?.name || "");
            setEmail(proposal.lead?.email || "");
            setShowAcceptForm(true);
            setShowRevisionForm(false);
          }}
          onRequestRevision={
            !isAccepted && !hasPendingRevision
              ? () => {
                  setName(proposal.lead?.name || "");
                  setEmail(proposal.lead?.email || "");
                  setShowRevisionForm(true);
                  setShowAcceptForm(false);
                }
              : undefined
          }
          revisionPending={hasPendingRevision}
        />
      </div>
    </div>
  );
}
