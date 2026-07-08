"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { ProposalDocument } from "@/components/proposal-document";
import {
  PublicErrorState,
  PublicLoadingState,
  PublicPageLayout,
} from "@/components/public-page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
    return <PublicLoadingState message="Loading proposal..." />;
  }

  if (error || !data) {
    return <PublicErrorState message="Proposal not found or link expired." />;
  }

  const { agency, ...proposal } = data;
  const isAccepted = proposal.status === "ACCEPTED" || accepted;
  const hasPendingRevision = proposal.status === "REVISION_REQUESTED" || revisionSubmitted;

  return (
    <PublicPageLayout>
      {revisionSubmitted && (
        <div className="no-print mb-6 rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 text-sm text-amber-900 backdrop-blur-xl">
          Your revision request has been submitted. We&apos;ll update the proposal and send you an updated
          link shortly.
        </div>
      )}

      {showAcceptForm && !isAccepted && (
        <div className="glass-panel-strong no-print mb-6 p-6">
          <h2 className="text-lg font-semibold">Confirm acceptance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your details to digitally accept this proposal.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              placeholder="Your email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              onClick={() => acceptMutation.mutate()}
              disabled={!name || !email || acceptMutation.isPending}
            >
              {acceptMutation.isPending ? "Processing..." : "Confirm acceptance"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowAcceptForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {showRevisionForm && !isAccepted && !hasPendingRevision && (
        <div className="glass-callout no-print mb-6 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="h-5 w-5 text-amber-700" />
            Request changes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us what you&apos;d like revised. We&apos;ll update the proposal and resend an updated link.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              placeholder="Your email (optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Textarea
            className="mt-3"
            placeholder="Describe the changes you'd like..."
            value={revisionComments}
            onChange={(e) => setRevisionComments(e.target.value)}
            rows={4}
          />
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              className="bg-amber-700 hover:bg-amber-800"
              onClick={() => revisionMutation.mutate()}
              disabled={!name || !revisionComments.trim() || revisionMutation.isPending}
            >
              {revisionMutation.isPending ? "Submitting..." : "Submit revision request"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowRevisionForm(false)}>
              Cancel
            </Button>
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
    </PublicPageLayout>
  );
}
