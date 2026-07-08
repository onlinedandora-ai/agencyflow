"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, ExternalLink, FileText, Upload } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AccessIntakeForm,
  BrandIntakeForm,
  OnboardingIntakeForm,
} from "@/components/portal/portal-intake-forms";
import { RazorpayPayButton } from "@/components/portal/razorpay-pay-button";
import {
  PublicErrorState,
  PublicLoadingState,
  PublicPageLayout,
} from "@/components/public-page-layout";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, cn, type AccessIntake, type BrandIntake, type OnboardingIntake } from "@/lib/api";

type Tab = "onboarding" | "brand" | "access" | "deliverables" | "billing";

const TABS: { key: Tab; label: string; sop: string }[] = [
  { key: "onboarding", label: "Onboarding", sop: "Client Onboarding Form" },
  { key: "brand", label: "Brand & assets", sop: "Brand Asset Intake" },
  { key: "access", label: "Access & social", sop: "Access & Credentials" },
  { key: "deliverables", label: "Deliverables", sop: "Work for your review" },
  { key: "billing", label: "Billing & payment", sop: "Invoice & payment" },
];

export default function ClientPortalPage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("onboarding");
  const [onboarding, setOnboarding] = useState<OnboardingIntake | null>(null);
  const [brand, setBrand] = useState<BrandIntake | null>(null);
  const [access, setAccess] = useState<AccessIntake | null>(null);
  const [savedMsg, setSavedMsg] = useState("");

  const [taxName, setTaxName] = useState("");
  const [taxEmail, setTaxEmail] = useState("");
  const [taxRequested, setTaxRequested] = useState(false);

  const [payName, setPayName] = useState("");
  const [payEmail, setPayEmail] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payMode, setPayMode] = useState<"BANK_TRANSFER" | "UPI">("BANK_TRANSFER");
  const [payNote, setPayNote] = useState("");
  const [payProof, setPayProof] = useState<string | null>(null);
  const [payMilestoneId, setPayMilestoneId] = useState<string>("");
  const [paySubmitted, setPaySubmitted] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal", token],
    queryFn: () => api.getClientPortal(token),
  });

  const { data: portalDeliverables = [] } = useQuery({
    queryKey: ["portal-deliverables", token],
    queryFn: () => api.getPortalDeliverables(token),
    enabled: !!data,
  });

  useEffect(() => {
    if (data) {
      setOnboarding(data.intake.onboarding);
      setBrand(data.intake.brand);
      setAccess(data.intake.access);
    }
  }, [data]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as Tab;
    if (hash && TABS.some((t) => t.key === hash)) setTab(hash);
  }, []);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portal", token] });

  const saveMutation = useMutation({
    mutationFn: ({ section, payload }: { section: Tab; payload: Record<string, unknown> }) =>
      api.savePortalIntake(token, section, payload),
    onSuccess: () => {
      setSavedMsg("Draft saved");
      setTimeout(() => setSavedMsg(""), 2500);
    },
  });

  const submitMutation = useMutation({
    mutationFn: ({ section, payload }: { section: Tab; payload: Record<string, unknown> }) =>
      api.submitPortalIntake(token, section, payload),
    onSuccess: () => {
      invalidate();
      setSavedMsg("Submitted — thank you!");
      setTimeout(() => setSavedMsg(""), 3000);
    },
  });

  const requestTaxMutation = useMutation({
    mutationFn: () => api.requestTaxInvoice(token, { requestedByName: taxName, requestedByEmail: taxEmail }),
    onSuccess: () => {
      setTaxRequested(true);
      invalidate();
    },
  });

  const paymentMutation = useMutation({
    mutationFn: () => {
      const inv = data?.payableInvoices[0];
      if (!inv) throw new Error("No payable invoice");
      const milestone = inv.milestones.find((m) => m.id === payMilestoneId);
      const amount = milestone ? Number(milestone.amount) : inv.amountDue;
      return api.submitPaymentClaim(token, {
        invoiceId: inv.id,
        milestoneId: milestone?.id,
        amount,
        paymentMode: payMode,
        paymentReference: payRef || undefined,
        submittedByName: payName,
        submittedByEmail: payEmail || undefined,
        proofNote: payNote || undefined,
        proofDataUrl: payProof ?? undefined,
      });
    },
    onSuccess: () => {
      setPaySubmitted(true);
      invalidate();
    },
  });

  function handleProofFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setPayProof(reader.result as string);
    reader.readAsDataURL(file);
  }

  if (isLoading) return <PublicLoadingState message="Loading client portal..." />;
  if (error || !data || !onboarding || !brand || !access) {
    return <PublicErrorState message="Client portal link not found." />;
  }

  const billing = data.billing;
  const isDraftFirst = data.workspace.billingFlow === "DRAFT_FIRST";
  const payable = data.payableInvoices[0];
  const pendingClaim = data.paymentClaims.find((c) => c.status === "PENDING");
  const selectedMilestone = payable?.milestones.find((m) => m.id === payMilestoneId);
  const payAmount = selectedMilestone
    ? Number(selectedMilestone.amount)
    : payable?.amountDue ?? 0;
  const payAmountLabel = `₹${payAmount.toLocaleString("en-IN")}`;
  const milestoneReady = !payable?.milestones.length || !!payMilestoneId;

  function renderIntakeActions(section: Tab, payload: Record<string, unknown>, submitted: boolean) {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/40 pt-6">
        {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
        {submitted && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Submitted
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate({ section, payload })}
        >
          Save draft
        </Button>
        <Button
          type="button"
          disabled={submitMutation.isPending}
          onClick={() => submitMutation.mutate({ section, payload })}
        >
          {submitMutation.isPending ? "Submitting..." : "Submit form"}
        </Button>
      </div>
    );
  }

  return (
    <PublicPageLayout>
      <div className="glass-panel-strong no-print mb-6 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Client portal</p>
        <h1 className="mt-1 text-2xl font-semibold">{data.workspace.company || data.workspace.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete onboarding forms, share brand assets &amp; social links, then confirm payment.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {data.steps.map((step) => (
            <span
              key={step.key}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                step.done ? "bg-green-50 text-green-800" : "bg-white/50 text-muted-foreground",
              )}
            >
              {step.done ? "✓ " : ""}
              {step.label}
            </span>
          ))}
        </div>
      </div>

      <div className="no-print mb-6 flex flex-wrap gap-2 border-b border-white/40 pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              window.location.hash = t.key;
            }}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              tab === t.key
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-white/50",
            )}
          >
            {t.label}
            {data.intake.submitted[t.key as keyof typeof data.intake.submitted] && tab !== t.key && " ✓"}
          </button>
        ))}
      </div>

      {tab === "onboarding" && (
        <div className="glass-panel no-print p-6">
          <h2 className="font-semibold">{TABS[0].sop}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Company, contacts, billing &amp; ways of working</p>
          <div className="mt-6">
            <OnboardingIntakeForm data={onboarding} onChange={setOnboarding} />
            {renderIntakeActions("onboarding", onboarding as unknown as Record<string, unknown>, data.intake.submitted.onboarding)}
          </div>
        </div>
      )}

      {tab === "brand" && (
        <div className="glass-panel no-print p-6">
          <h2 className="font-semibold">{TABS[1].sop}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Share document links, brand voice &amp; asset folder</p>
          <div className="mt-6">
            <BrandIntakeForm data={brand} onChange={setBrand} />
            {renderIntakeActions("brand", brand as unknown as Record<string, unknown>, data.intake.submitted.brand)}
          </div>
        </div>
      )}

      {tab === "access" && (
        <div className="glass-panel no-print p-6">
          <h2 className="font-semibold">{TABS[2].sop}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Social handles &amp; platform access — no passwords</p>
          <div className="mt-6">
            <AccessIntakeForm data={access} onChange={setAccess} />
            {renderIntakeActions("access", access as unknown as Record<string, unknown>, data.intake.submitted.access)}
          </div>
        </div>
      )}

      {tab === "deliverables" && (
        <div className="glass-panel no-print p-6">
          <h2 className="font-semibold">{TABS[3].sop}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and approve work shared by your agency team.
          </p>
          {portalDeliverables.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No deliverables shared yet.</p>
          ) : (
            <div className="mt-6 space-y-3">
              {portalDeliverables.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white/40 p-4 text-sm">
                  <div>
                    <p className="font-medium">{d.label}</p>
                    <p className="text-muted-foreground">{d.task?.title} · {d.task?.project?.name}</p>
                    {d.status === "CLIENT_APPROVED" && (
                      <p className="mt-1 text-xs text-green-700">Approved ✓</p>
                    )}
                  </div>
                  {d.publicUrl && (
                    <a
                      href={d.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ size: "sm" })}
                    >
                      <ExternalLink className="h-4 w-4" /> Review
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "billing" && (
        <div className="no-print space-y-6">
          {data.agency.bankName && (
            <div className="glass-callout p-6">
              <h2 className="font-semibold">Bank details for payment</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Transfer the amount due, then upload your payment screenshot below.
              </p>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Bank</dt><dd className="font-medium">{data.agency.bankName}</dd></div>
                <div><dt className="text-muted-foreground">Account</dt><dd className="font-mono font-medium">{data.agency.bankAccount}</dd></div>
                <div><dt className="text-muted-foreground">IFSC</dt><dd className="font-mono font-medium">{data.agency.bankIfsc}</dd></div>
                <div><dt className="text-muted-foreground">Account name</dt><dd className="font-medium">{data.agency.name}</dd></div>
              </dl>
            </div>
          )}

          {billing.draftInvoice && (
            <div className="glass-panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 font-semibold">
                    <FileText className="h-5 w-5 text-primary" />
                    Draft invoice — {billing.draftInvoice.number}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">Review and download. Not a tax invoice.</p>
                </div>
                <a href={`/billing/doc/${billing.draftInvoice.publicToken}?print=1`} target="_blank" rel="noreferrer" className={buttonVariants()}>
                  <Download className="h-4 w-4" /> Download PDF
                </a>
              </div>
            </div>
          )}

          {isDraftFirst && !billing.taxInvoice && !billing.pendingTaxRequest && !taxRequested && billing.draftInvoice && (
            <div className="glass-callout p-6">
              <h2 className="font-semibold">Ready for tax invoice?</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input placeholder="Your name" value={taxName} onChange={(e) => setTaxName(e.target.value)} />
                <Input placeholder="Email" type="email" value={taxEmail} onChange={(e) => setTaxEmail(e.target.value)} />
              </div>
              <Button type="button" className="mt-4" onClick={() => requestTaxMutation.mutate()} disabled={!taxName || requestTaxMutation.isPending}>
                {requestTaxMutation.isPending ? "Submitting..." : "Request tax invoice"}
              </Button>
            </div>
          )}

          {(billing.pendingTaxRequest || taxRequested) && !billing.taxInvoice && (
            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 text-sm text-amber-900">
              Tax invoice requested — we&apos;ll issue it shortly.
            </div>
          )}

          {billing.milestones.length > 0 && (
            <div className="glass-panel p-6">
              <h2 className="font-semibold">Payment schedule</h2>
              <div className="mt-4 space-y-2">
                {billing.milestones.map((m) => (
                  <div key={m.id} className={cn("flex justify-between rounded-xl border px-4 py-3 text-sm", m.status === "PAID" ? "border-green-200 bg-green-50/50" : "border-white/50 bg-white/40")}>
                    <span>{m.label}</span>
                    <span className="font-medium">₹{Number(m.amount).toLocaleString("en-IN")}{m.status === "PAID" ? " · Paid ✓" : " · Due"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {billing.taxInvoice && (
            <div className="glass-panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Tax invoice — {billing.taxInvoice.number}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Status: {billing.taxInvoice.status}
                    {billing.taxInvoice.amountDue !== undefined && billing.taxInvoice.amountDue > 0 && (
                      <> · ₹{billing.taxInvoice.amountDue.toLocaleString("en-IN")} remaining</>
                    )}
                  </p>
                </div>
                <a href={`/billing/doc/${billing.taxInvoice.publicToken}?print=1`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                  <Download className="h-4 w-4" /> Download
                </a>
              </div>
              {billing.taxInvoice.status === "PAID" && (
                <p className="mt-3 flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Payment received — thank you!
                </p>
              )}
            </div>
          )}

          {payable && billing.taxInvoice?.status !== "PAID" && (
            <div className="glass-panel p-6">
              <h2 className="font-semibold">Pay invoice</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pay online instantly, or transfer to our bank account and upload proof.
              </p>

              {pendingClaim && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
                  Bank transfer of ₹{pendingClaim.amount.toLocaleString("en-IN")} submitted on{" "}
                  {new Date(pendingClaim.submittedAt).toLocaleDateString("en-IN")} — awaiting validation.
                </div>
              )}

              {!pendingClaim && !paySubmitted && (
                <div className="mt-4 space-y-6">
                  {payable.milestones.length > 0 && (
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Payment milestone *</span>
                      <select
                        className="w-full rounded-lg border border-white/50 bg-white/60 px-3 py-2 text-sm"
                        value={payMilestoneId}
                        onChange={(e) => setPayMilestoneId(e.target.value)}
                      >
                        <option value="">Select milestone</option>
                        {payable.milestones.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label} — ₹{Number(m.amount).toLocaleString("en-IN")}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input placeholder="Your name *" value={payName} onChange={(e) => setPayName(e.target.value)} />
                    <Input placeholder="Email" type="email" value={payEmail} onChange={(e) => setPayEmail(e.target.value)} />
                  </div>

                  {data.razorpay.enabled && milestoneReady && payAmount > 0 && (
                    <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-4">
                      <p className="text-sm font-medium text-primary">Pay online (Razorpay)</p>
                      <p className="mt-1 text-xs text-muted-foreground">UPI, cards, netbanking — receipt issued instantly</p>
                      <div className="mt-3">
                        <RazorpayPayButton
                          token={token}
                          invoiceId={payable.id}
                          milestoneId={payMilestoneId || undefined}
                          payerName={payName}
                          payerEmail={payEmail}
                          agencyName={data.agency.name}
                          amountLabel={payAmountLabel}
                          disabled={!payName || !milestoneReady}
                          onSuccess={() => invalidate()}
                        />
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/50" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-transparent px-2 text-muted-foreground">Or bank transfer</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">Payment mode</span>
                        <select className="w-full rounded-lg border border-white/50 bg-white/60 px-3 py-2 text-sm" value={payMode} onChange={(e) => setPayMode(e.target.value as "BANK_TRANSFER" | "UPI")}>
                          <option value="BANK_TRANSFER">Bank transfer (NEFT/IMPS)</option>
                          <option value="UPI">UPI</option>
                        </select>
                      </label>
                      <Input placeholder="UTR / transaction reference" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                    </div>
                    <Input placeholder="Notes (optional)" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-white/40 p-8 text-center">
                      <Upload className="h-8 w-8 text-primary" />
                      <span className="mt-2 text-sm font-medium">Upload payment screenshot *</span>
                      <span className="text-xs text-muted-foreground">PNG or JPG, max ~1 MB</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleProofFile(e.target.files?.[0] ?? null)} />
                      {payProof && <span className="mt-2 text-xs text-green-600">Screenshot attached ✓</span>}
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => paymentMutation.mutate()}
                      disabled={!payName || !payProof || !milestoneReady || paymentMutation.isPending}
                    >
                      {paymentMutation.isPending ? "Submitting..." : "Submit bank transfer proof"}
                    </Button>
                  </div>
                </div>
              )}

              {paySubmitted && (
                <p className="mt-4 text-sm text-green-600">
                  Payment submitted for review. You&apos;ll receive your receipt once validated.
                </p>
              )}
            </div>
          )}

          {billing.receipts.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold">Payment receipts</h2>
              {billing.receipts.map((receipt) => (
                <div key={receipt.id} className="glass-panel flex items-center justify-between p-4">
                  <span className="text-sm font-medium">{receipt.number}</span>
                  <a href={`/billing/doc/${receipt.publicToken}?print=1`} target="_blank" rel="noreferrer" className="text-sm text-primary">
                    Download receipt
                  </a>
                </div>
              ))}
            </div>
          )}

          {data.paymentClaims.filter((c) => c.status === "REJECTED").length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 text-sm text-red-900">
              <p className="font-medium">Previous payment not accepted</p>
              {data.paymentClaims
                .filter((c) => c.status === "REJECTED")
                .map((c) => (
                  <p key={c.id} className="mt-1">
                    {c.reviewNote || "Please resubmit with corrected proof."}
                  </p>
                ))}
            </div>
          )}
        </div>
      )}
    </PublicPageLayout>
  );
}
