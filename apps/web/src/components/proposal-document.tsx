import type { AgencyProfile, CaseStudy, Proposal } from "@/lib/api";
import { CheckCircle2, Mail, MapPin, Phone } from "lucide-react";

const SECTIONS = [
  { key: "situation", label: "Situation", subtitle: "Understanding your context" },
  { key: "recommendation", label: "Recommendation", subtitle: "Our strategic approach" },
  { key: "deliverables", label: "Deliverables", subtitle: "What you will receive" },
  { key: "timeline", label: "Timeline", subtitle: "Project schedule" },
  { key: "investment", label: "Investment", subtitle: "Commercial terms" },
  { key: "nextStep", label: "Next Step", subtitle: "How to proceed" },
] as const;

type ProposalDocumentProps = {
  proposal: Proposal;
  agency: AgencyProfile;
  caseStudy?: CaseStudy | null;
  mode?: "preview" | "client";
  onAccept?: () => void;
  onRequestRevision?: () => void;
  acceptLoading?: boolean;
  acceptDisabled?: boolean;
  revisionPending?: boolean;
};

export function ProposalDocument({
  proposal,
  agency,
  caseStudy,
  mode = "preview",
  onAccept,
  onRequestRevision,
  acceptLoading,
  acceptDisabled,
  revisionPending,
}: ProposalDocumentProps) {
  const lead = proposal.lead;
  const issueDate = proposal.sentAt ? new Date(proposal.sentAt) : new Date();
  const formattedDate = issueDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isAccepted = proposal.status === "ACCEPTED" || proposal.isAccepted;

  return (
    <article className="proposal-document mx-auto w-full max-w-[800px] bg-white text-[var(--color-ink)] shadow-[0_4px_24px_rgba(11,16,32,0.08)]">
      {/* Top accent */}
      <div className="h-1.5 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-primary)]" />

      {/* Header — agency + meta */}
      <header className="border-b border-[var(--color-border)] px-4 sm:px-10 pb-6 sm:pb-8 pt-6 sm:pt-10">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-8">
          <div>
            <p className="text-2xl font-semibold tracking-tight">{agency.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{agency.tagline}</p>
          </div>
          <div className="text-left sm:text-right text-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Proposal
            </p>
            <p className="mt-2 font-mono text-base font-semibold">
              {proposal.proposalNumber || "DRAFT"}
              {(proposal.currentVersion ?? 0) > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  v{proposal.currentVersion}
                </span>
              )}
            </p>
            <p className="mt-1 text-muted-foreground">Issued {formattedDate}</p>
            {proposal.sentAt && !isAccepted && (
              <span className="mt-2 inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-primary">
                Awaiting acceptance
              </span>
            )}
            {isAccepted && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Accepted
              </span>
            )}
          </div>
        </div>

        {/* Client + Agency details */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Prepared for
            </p>
            <p className="mt-3 text-lg font-semibold">{lead?.name || "Client"}</p>
            {lead?.company && <p className="mt-1 text-sm font-medium">{lead.company}</p>}
            <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              {lead?.email && (
                <p className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {lead.email}
                </p>
              )}
              {lead?.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {lead.phone}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Prepared by
            </p>
            <p className="mt-3 text-lg font-semibold">{agency.name}</p>
            <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              {agency.address && (
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {agency.address}
                    {agency.city ? `, ${agency.city}` : ""}
                  </span>
                </p>
              )}
              {agency.email && (
                <p className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {agency.email}
                </p>
              )}
              {agency.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {agency.phone}
                </p>
              )}
              {agency.gstin && <p className="font-mono text-xs">GSTIN: {agency.gstin}</p>}
              {agency.website && <p>{agency.website}</p>}
            </div>
          </div>
        </div>
      </header>

      {/* Proposal body */}
      <div className="px-4 py-6 sm:px-10 sm:py-10">
        {SECTIONS.map((section, index) => {
          const value = proposal[section.key as keyof Proposal] as string | null | undefined;
          if (!value?.trim()) return null;

          return (
            <section
              key={section.key}
              className={index > 0 ? "mt-12 border-t border-[var(--color-border)] pt-12" : ""}
            >
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-sm font-semibold text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="text-xl font-semibold">{section.label}</h2>
                  <p className="text-sm text-muted-foreground">{section.subtitle}</p>
                </div>
              </div>
              <div className="proposal-section-body mt-5 whitespace-pre-wrap pl-4 sm:pl-9 text-[15px] leading-8 text-[var(--color-ink)]">
                {section.key === "deliverables" ? (
                  <ul className="space-y-2">
                    {value.split("\n").filter(Boolean).map((line, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>{line.replace(/^[•\-]\s*/, "")}</span>
                      </li>
                    ))}
                  </ul>
                ) : section.key === "investment" ? (
                  <div className="rounded-xl border-2 border-[var(--color-primary)]/20 bg-indigo-50/40 p-6">
                    <p className="whitespace-pre-wrap font-medium">{value}</p>
                  </div>
                ) : (
                  value
                )}
              </div>
            </section>
          );
        })}

        {caseStudy && (
          <section className="mt-12 border-t border-[var(--color-border)] pt-12">
            <h2 className="text-xl font-semibold">Relevant work</h2>
            <p className="text-sm text-muted-foreground">A similar project from our portfolio</p>
            <div className="mt-5 rounded-xl border border-[var(--color-border)] p-6">
              <p className="font-semibold">{caseStudy.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {caseStudy.clientName} · {caseStudy.serviceLine}
              </p>
              <p className="mt-3 text-sm leading-7">{caseStudy.summary}</p>
              {caseStudy.outcome && (
                <p className="mt-3 text-sm font-medium text-green-600">
                  Result: {caseStudy.outcome}
                </p>
              )}
            </div>
          </section>
        )}

        {proposal.termsAndConditions && (
          <section className="proposal-page-break mt-12 border-t border-[var(--color-border)] pt-12">
            <h2 className="text-xl font-semibold">Terms &amp; Conditions</h2>
            <p className="text-sm text-muted-foreground">Standard commercial terms for this engagement</p>
            <div className="mt-5 whitespace-pre-wrap rounded-xl bg-[var(--color-bg)] p-6 text-sm leading-7 text-muted-foreground">
              {proposal.termsAndConditions}
            </div>
          </section>
        )}

        {agency.bankName && (
          <section className="mt-12 border-t border-[var(--color-border)] pt-12">
            <h2 className="text-lg font-semibold">Payment details</h2>
            <div className="mt-4 grid gap-2 font-mono text-sm text-muted-foreground">
              <p>Bank: {agency.bankName}</p>
              <p>Account: {agency.bankAccount}</p>
              <p>IFSC: {agency.bankIfsc}</p>
            </div>
          </section>
        )}
      </div>

      {/* Acceptance footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-6 sm:px-10 sm:py-10">
        {isAccepted ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6">
            <p className="flex items-center gap-2 font-semibold text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Proposal accepted
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Signed by <strong>{proposal.acceptedByName}</strong> ({proposal.acceptedByEmail})
              {proposal.acceptedAt &&
                ` on ${new Date(proposal.acceptedAt).toLocaleString("en-IN")}`}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Advance invoice has been raised. Work begins once payment is confirmed.
            </p>
          </div>
        ) : mode === "client" && onAccept ? (
          <div className="flex flex-col gap-6">
            {revisionPending ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
                <p className="font-semibold text-amber-900">Revision request received</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  We&apos;re working on your requested changes and will send an updated proposal link
                  shortly.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold">Ready to proceed?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    By accepting, you agree to the scope, investment, and terms above. We&apos;ll send
                    your advance invoice and onboarding pack immediately.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <button
                    type="button"
                    onClick={onAccept}
                    disabled={acceptDisabled || acceptLoading}
                    className="rounded-xl bg-[var(--color-primary)] px-8 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {acceptLoading ? "Processing..." : "Accept Proposal"}
                  </button>
                  {onRequestRevision && (
                    <button
                      type="button"
                      onClick={onRequestRevision}
                      className="text-sm font-medium text-amber-700 hover:underline"
                    >
                      Request changes instead
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Share the client link after sending so the client can review and accept online.
          </p>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {agency.name}
          {agency.gstin ? ` · GSTIN ${agency.gstin}` : ""} · {agency.email}
        </p>
      </footer>
    </article>
  );
}
