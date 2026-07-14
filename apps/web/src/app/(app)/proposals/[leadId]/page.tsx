"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, RefreshCw, Send } from "lucide-react";
import { ProposalActivityTimeline } from "@/components/proposal-activity-timeline";
import { SendProposalModal } from "@/components/send-proposal-modal";
import { api, cn } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const SECTIONS = [
  { key: "situation", label: "Situation", placeholder: "What is the client's current situation?" },
  { key: "recommendation", label: "Recommendation", placeholder: "What do you recommend?" },
  { key: "deliverables", label: "Deliverables", placeholder: "What will be delivered?" },
  { key: "timeline", label: "Timeline", placeholder: "Key milestones and dates" },
  { key: "investment", label: "Investment", placeholder: "Pricing and payment terms" },
  { key: "nextStep", label: "Next Step", placeholder: "Clear call to action" },
] as const;

export default function ProposalBuilderPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const token = useAuthStore((s) => s.token)!;
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [caseStudyId, setCaseStudyId] = useState("");
  const [terms, setTerms] = useState("");
  const [billingFlow, setBillingFlow] = useState("DIRECT");
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendMode, setSendMode] = useState<"send" | "resend">("send");
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: proposal, isLoading } = useQuery({
    queryKey: ["proposal", leadId],
    queryFn: () => api.getProposalByLead(token, leadId),
  });

  const { data: history } = useQuery({
    queryKey: ["proposal-history", leadId],
    queryFn: () => api.getProposalHistory(token, leadId),
    enabled: (proposal?.currentVersion ?? 0) > 0,
  });

  const { data: caseStudies = [] } = useQuery({
    queryKey: ["case-studies"],
    queryFn: () => api.getCaseStudies(token),
  });

  const { data: agency } = useQuery({
    queryKey: ["agency"],
    queryFn: () => api.getAgencyProfile(token),
  });

  useEffect(() => {
    if (proposal) {
      setForm({
        situation: proposal.situation || "",
        recommendation: proposal.recommendation || "",
        deliverables: proposal.deliverables || "",
        timeline: proposal.timeline || "",
        investment: proposal.investment || "",
        nextStep: proposal.nextStep || "",
      });
      setCaseStudyId(proposal.caseStudyId || "");
      setTerms(proposal.termsAndConditions || agency?.defaultTermsAndConditions || "");
      setBillingFlow(proposal.billingFlow || "DIRECT");
    }
  }, [proposal, agency]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.upsertProposal(token, leadId, {
        ...form,
        caseStudyId: caseStudyId || undefined,
        termsAndConditions: terms,
        billingFlow,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["proposal", leadId] }),
  });

  const sendMutation = useMutation({
    mutationFn: (internalNote?: string) =>
      sendMode === "resend"
        ? api.resendProposal(token, leadId, internalNote)
        : api.sendProposal(token, leadId, internalNote),
    onSuccess: () => {
      setShowSendModal(false);
      queryClient.invalidateQueries({ queryKey: ["proposal", leadId] });
      queryClient.invalidateQueries({ queryKey: ["proposal-history", leadId] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  if (isLoading || !proposal) {
    return <p className="text-sm text-muted-foreground">Loading proposal...</p>;
  }

  const canEdit = proposal.canEdit !== false && !proposal.isAccepted;
  const hasPendingRevisions = proposal.revisionRequests?.some(
    (r) => r.status === "PENDING" || r.status === "IN_PROGRESS",
  );
  const clientUrl = proposal.publicToken
    ? `${window.location.origin}/p/${proposal.publicToken}`
    : proposal.clientUrl || "";

  function openSendModal(mode: "send" | "resend") {
    setSendMode(mode);
    setShowSendModal(true);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/proposals/list" className="text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Proposal — {proposal.lead?.name}</h1>
          <p className="text-sm text-muted-foreground">
            {proposal.proposalNumber || "Draft"}
            {(proposal.currentVersion ?? 0) > 0 && ` · v${proposal.currentVersion}`}
          </p>
        </div>
        <Link href={`/discovery/${leadId}`} className="text-sm text-primary">
          Discovery →
        </Link>
        <Link
          href={`/proposals/${leadId}/preview`}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:border-[var(--color-primary)]"
        >
          Preview
        </Link>
      </div>

      {hasPendingRevisions && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Client requested revisions.</strong> Update the proposal below, then resend with the
          share link.
        </div>
      )}

      {(proposal.currentVersion ?? 0) > 0 && clientUrl && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Active client link (v{proposal.currentVersion})
          </p>
          <p className="mt-2 break-all font-mono text-sm">{clientUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(clientUrl);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium"
            >
              <Copy className="h-3.5 w-3.5" />
              {linkCopied ? "Copied!" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => openSendModal("resend")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Resend proposal
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 glass-panel p-4 text-sm">
        <span className={cn(proposal.overWordLimit && "font-medium text-amber-600")}>
          {proposal.wordCount} / {proposal.wordLimit} words
        </span>
        {proposal.status === "REVISION_REQUESTED" && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Revision requested
          </span>
        )}
        {proposal.isAccepted && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            Accepted
          </span>
        )}
      </div>

      {history && (history.sendLogs.length > 0 || history.revisionRequests.length > 0) && (
        <div className="glass-panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Activity log</h2>
          <ProposalActivityTimeline history={history} />
        </div>
      )}

      <div className="glass-panel p-4">
        <label className="mb-2 block text-sm font-medium">Billing flow</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer gap-3 rounded-lg border p-3 has-[:checked]:border-[var(--color-primary)] has-[:checked]:bg-indigo-50/40">
            <input
              type="radio"
              name="billingFlow"
              value="DIRECT"
              checked={billingFlow === "DIRECT"}
              onChange={() => setBillingFlow("DIRECT")}
              disabled={!canEdit}
              className="mt-1"
            />
            <div>
              <p className="text-sm font-medium">Path A — Direct</p>
              <p className="text-xs text-muted-foreground">
                Client accepts → advance tax invoice sent immediately
              </p>
            </div>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-lg border p-3 has-[:checked]:border-[var(--color-primary)] has-[:checked]:bg-indigo-50/40">
            <input
              type="radio"
              name="billingFlow"
              value="DRAFT_FIRST"
              checked={billingFlow === "DRAFT_FIRST"}
              onChange={() => setBillingFlow("DRAFT_FIRST")}
              disabled={!canEdit}
              className="mt-1"
            />
            <div>
              <p className="text-sm font-medium">Path B — Draft invoice first</p>
              <p className="text-xs text-muted-foreground">
                Client accepts → draft invoice PDF → requests tax invoice → payment
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="glass-panel p-4">
        <label className="mb-2 block text-sm font-medium">Attach pilot case study</label>
        <select
          value={caseStudyId}
          onChange={(e) => setCaseStudyId(e.target.value)}
          disabled={!canEdit}
          className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
        >
          <option value="">None</option>
          {caseStudies.map((cs) => (
            <option key={cs.id} value={cs.id}>
              {cs.title} — {cs.clientName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.key} className="glass-panel p-4">
            <label className="mb-2 block text-sm font-semibold">{section.label}</label>
            <textarea
              value={form[section.key] || ""}
              onChange={(e) => setForm({ ...form, [section.key]: e.target.value })}
              placeholder={section.placeholder}
              rows={3}
              disabled={!canEdit}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] disabled:opacity-60"
            />
          </div>
        ))}

        <div className="glass-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold">Terms &amp; Conditions</label>
            <span className="text-xs text-muted-foreground">Editable per proposal</span>
          </div>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={8}
            disabled={!canEdit}
            className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {canEdit && (
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            {saveMutation.isPending ? "Saving..." : "Save draft"}
          </button>
        )}
        {!proposal.isAccepted && (proposal.currentVersion ?? 0) === 0 && (
          <button
            type="button"
            onClick={() => openSendModal("send")}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            <Send className="h-4 w-4" />
            Send proposal
          </button>
        )}
        {!proposal.isAccepted && (proposal.currentVersion ?? 0) > 0 && canEdit && (
          <button
            type="button"
            onClick={() => openSendModal("resend")}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Resend updated proposal
          </button>
        )}
      </div>

      <SendProposalModal
        open={showSendModal}
        onClose={() => setShowSendModal(false)}
        onConfirm={(note) => sendMutation.mutate(note)}
        loading={sendMutation.isPending}
        clientUrl={clientUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/p/preview`}
        clientName={proposal.lead?.name || "Client"}
        clientEmail={proposal.lead?.email}
        isResend={sendMode === "resend"}
        version={proposal.currentVersion ?? 0}
      />
    </div>
  );
}
