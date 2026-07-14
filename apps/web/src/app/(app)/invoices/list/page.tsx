"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FileText, Receipt, Settings2 } from "lucide-react";
import { SendMilestoneNotificationModal } from "@/components/send-milestone-notification-modal";
import { api, cn } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const TYPE_BADGES: Record<string, string> = {
  DRAFT: "bg-amber-50 text-amber-800",
  TAX: "bg-indigo-50 text-primary",
  RECEIPT: "bg-green-50 text-green-800",
};

const STATUS_BADGES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-50 text-blue-800",
  REQUESTED: "bg-amber-50 text-amber-800",
  PARTIALLY_PAID: "bg-amber-50 text-amber-800",
  PAID: "bg-green-50 text-green-800",
  OVERDUE: "bg-red-50 text-red-800",
};

export default function InvoicesPage() {
  const token = useAuthStore((s) => s.token)!;
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("ALL");
  const [showNumbering, setShowNumbering] = useState(false);
  const [numbering, setNumbering] = useState({
    draftInvoicePrefix: "DRF",
    draftInvoiceNextSeq: 1,
    taxInvoicePrefix: "INV",
    taxInvoiceNextSeq: 1,
    receiptPrefix: "RCT",
    receiptNextSeq: 1,
  });
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMilestoneId, setPaymentMilestoneId] = useState("");
  const [milestoneModal, setMilestoneModal] = useState<string | null>(null);
  const [milestoneTemplate, setMilestoneTemplate] = useState("ONE_TIME_50_50");
  const [notifyModal, setNotifyModal] = useState<{
    milestoneId: string;
    label: string;
    amount: string;
    clientName: string;
    clientEmail?: string | null;
  } | null>(null);
  const [notifyResult, setNotifyResult] = useState<{
    notificationText: string;
    billingUrl?: string | null;
    whatsappUrl: string;
    mailtoUrl?: string | null;
    clientName: string;
    clientEmail?: string | null;
  } | null>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", filter],
    queryFn: () =>
      api.getInvoices(
        token,
        filter !== "ALL" ? { documentType: filter } : undefined,
      ),
  });

  const { data: numberingSettings } = useQuery({
    queryKey: ["invoice-numbering"],
    queryFn: () => api.getInvoiceNumbering(token),
    enabled: showNumbering,
  });

  useEffect(() => {
    if (numberingSettings) setNumbering(numberingSettings);
  }, [numberingSettings]);

  const saveNumberingMutation = useMutation({
    mutationFn: () => api.updateInvoiceNumbering(token, numbering),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoice-numbering"] }),
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => api.issueTaxInvoice(token, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const { data: milestoneTemplates = [] } = useQuery({
    queryKey: ["milestone-templates"],
    queryFn: () => api.getMilestoneTemplates(token),
    enabled: !!milestoneModal,
  });

  const milestoneMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      api.setInvoiceMilestones(token, invoiceId, { templateKey: milestoneTemplate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setMilestoneModal(null);
    },
  });

  const notifyMutation = useMutation({
    mutationFn: ({ milestoneId, note }: { milestoneId: string; note?: string }) =>
      api.sendMilestoneNotification(token, milestoneId, note),
    onSuccess: (data) => {
      setNotifyResult({
        notificationText: data.notificationText,
        billingUrl: data.billingUrl,
        whatsappUrl: data.whatsappUrl,
        mailtoUrl: data.mailtoUrl,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
      });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const payMutation = useMutation({
    mutationFn: (id: string) =>
      api.recordPayment(token, id, {
        paymentMode: "OFFLINE",
        paymentReference: paymentRef || "Bank transfer",
        amount: paymentMilestoneId ? undefined : paymentAmount ? parseFloat(paymentAmount) : undefined,
        milestoneId: paymentMilestoneId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setPaymentModal(null);
      setPaymentRef("");
      setPaymentMilestoneId("");
    },
  });

  const filters = [
    { key: "ALL", label: "All" },
    { key: "DRAFT", label: "Draft invoices" },
    { key: "TAX", label: "Tax invoices" },
    { key: "RECEIPT", label: "Receipts" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Draft invoices, tax invoices, and payment receipts — all in one place
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowNumbering((v) => !v);
            if (numberingSettings) setNumbering(numberingSettings);
          }}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm"
        >
          <Settings2 className="h-4 w-4" />
          Numbering
        </button>
      </div>

      {showNumbering && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveNumberingMutation.mutate();
          }}
          className="glass-panel grid gap-4 p-5 md:grid-cols-3"
        >
          <p className="md:col-span-3 text-sm font-medium">Admin invoice numbering (sequential)</p>
          {[
            ["draftInvoicePrefix", "draftInvoiceNextSeq", "Draft prefix / next #"],
            ["taxInvoicePrefix", "taxInvoiceNextSeq", "Tax prefix / next #"],
            ["receiptPrefix", "receiptNextSeq", "Receipt prefix / next #"],
          ].map(([prefixKey, seqKey, label]) => (
            <div key={prefixKey}>
              <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
              <div className="flex gap-2">
                <input
                  value={String(numbering[prefixKey as keyof typeof numbering])}
                  onChange={(e) => setNumbering({ ...numbering, [prefixKey]: e.target.value })}
                  className="w-20 rounded-lg border px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  value={Number(numbering[seqKey as keyof typeof numbering])}
                  onChange={(e) =>
                    setNumbering({ ...numbering, [seqKey]: parseInt(e.target.value, 10) || 1 })
                  }
                  className="flex-1 rounded-lg border px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          ))}
          <button type="submit" className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-white md:col-span-3 md:ml-auto">
            Save numbering
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              filter === f.key ? "bg-[var(--color-primary)] text-white" : "bg-white border",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading invoices...</p>
      ) : invoices.length === 0 ? (
        <div className="glass-panel border-dashed p-8 text-center">
          <Receipt className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No invoices yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <article key={inv.id} className="glass-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-mono font-semibold">{inv.number}</h2>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", TYPE_BADGES[inv.documentType])}>
                      {inv.typeLabel}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS_BADGES[inv.status])}>
                      {inv.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {inv.workspace?.company || inv.workspace?.name} · ₹
                    {Number(inv.amount).toLocaleString("en-IN")}
                    {inv.amountDue !== undefined && inv.amountDue > 0 && inv.amountPaid !== undefined && inv.amountPaid > 0 && (
                      <span className="text-amber-700">
                        {" "}· ₹{inv.amountPaid.toLocaleString("en-IN")} paid · ₹{inv.amountDue.toLocaleString("en-IN")} due
                      </span>
                    )}
                  </p>
                  {inv.requestedByName && (
                    <p className="mt-1 text-xs text-amber-700">
                      Requested by {inv.requestedByName}
                      {inv.requestedAt && ` · ${new Date(inv.requestedAt).toLocaleString("en-IN")}`}
                    </p>
                  )}
                  {inv.paymentMilestones && inv.paymentMilestones.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {inv.paymentMilestones.map((m) => (
                        <div key={m.id} className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              m.status === "PAID" ? "bg-green-50 text-green-800" : "bg-[var(--color-bg)] text-muted-foreground",
                            )}
                          >
                            {m.label}: ₹{Number(m.amount).toLocaleString("en-IN")} {m.status === "PAID" ? "✓" : ""}
                          </span>
                          {m.status === "PENDING" && (
                            <button
                              type="button"
                              onClick={() => {
                                setNotifyResult(null);
                                setNotifyModal({
                                  milestoneId: m.id,
                                  label: m.label,
                                  amount: Number(m.amount).toLocaleString("en-IN"),
                                  clientName: inv.workspace?.name || "Client",
                                  clientEmail: null,
                                });
                              }}
                              className="text-[10px] font-medium text-primary hover:underline"
                            >
                              Send notification
                            </button>
                          )}
                          {(m.notifications?.length ?? 0) > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              · Notified {new Date(m.notifications![0].sentAt).toLocaleDateString("en-IN")}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {inv.publicToken && (
                    <a
                      href={`/d/${inv.publicToken}?print=1`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      PDF
                    </a>
                  )}
                  {inv.billingUrl && (
                    <a
                      href={inv.billingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border px-3 py-1.5 text-xs text-primary"
                    >
                      Client link
                    </a>
                  )}
                  {inv.status === "REQUESTED" && inv.documentType === "TAX" && (
                    <button
                      type="button"
                      onClick={() => issueMutation.mutate(inv.id)}
                      disabled={issueMutation.isPending}
                      className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white"
                    >
                      Issue tax invoice
                    </button>
                  )}
                  {inv.documentType === "TAX" && inv.status !== "PAID" && inv.status !== "REQUESTED" && !inv.paymentMilestones?.some((m) => m.status === "PAID") && (
                    <button
                      type="button"
                      onClick={() => setMilestoneModal(inv.id)}
                      className="rounded-lg border px-3 py-1.5 text-xs"
                    >
                      {inv.paymentMilestones?.length ? "Update milestones" : "Set milestones"}
                    </button>
                  )}
                  {inv.documentType !== "RECEIPT" && inv.documentType !== "DRAFT" && inv.status !== "PAID" && inv.status !== "REQUESTED" && (
                    <button
                      type="button"
                      onClick={() => {
                        const pending = inv.paymentMilestones?.find((m) => m.status === "PENDING");
                        setPaymentModal(inv.id);
                        setPaymentMilestoneId(pending?.id || "");
                        setPaymentAmount(pending ? String(pending.amount) : inv.amountDue ? String(inv.amountDue) : String(inv.amount));
                      }}
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-800"
                    >
                      Record payment
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {milestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-panel-strong w-full max-w-md p-6">
            <h3 className="font-semibold">Payment milestones</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Team fixes the payment schedule on this invoice. Amounts must total the invoice value.
            </p>
            <select
              value={milestoneTemplate}
              onChange={(e) => setMilestoneTemplate(e.target.value)}
              className="mt-4 w-full rounded-lg border px-3 py-2 text-sm"
            >
              {milestoneTemplates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label} — {t.description}
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setMilestoneModal(null)} className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => milestoneMutation.mutate(milestoneModal)}
                disabled={milestoneMutation.isPending}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-white"
              >
                {milestoneMutation.isPending ? "Saving..." : "Apply schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentModal && (() => {
        const inv = invoices.find((i) => i.id === paymentModal);
        const pendingMilestones = inv?.paymentMilestones?.filter((m) => m.status === "PENDING") ?? [];
        const hasMilestones = pendingMilestones.length > 0;
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-panel-strong w-full max-w-md p-6">
            <h3 className="font-semibold">Record payment</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Each payment generates a separate receipt linked to this invoice.
            </p>
            {hasMilestones ? (
              <select
                value={paymentMilestoneId}
                onChange={(e) => {
                  setPaymentMilestoneId(e.target.value);
                  const m = pendingMilestones.find((x) => x.id === e.target.value);
                  if (m) setPaymentAmount(String(m.amount));
                }}
                className="mt-4 w-full rounded-lg border px-3 py-2 text-sm"
              >
                {pendingMilestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — ₹{Number(m.amount).toLocaleString("en-IN")}
                  </option>
                ))}
              </select>
            ) : (
              <input
                placeholder="Amount (₹)"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="mt-4 w-full rounded-lg border px-3 py-2 text-sm"
              />
            )}
            <input
              placeholder="Payment reference (UTR, cheque #, etc.)"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPaymentModal(null)} className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => payMutation.mutate(paymentModal)}
                disabled={payMutation.isPending || (hasMilestones && !paymentMilestoneId)}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-white"
              >
                {payMutation.isPending ? "Saving..." : "Confirm payment"}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      <SendMilestoneNotificationModal
        open={!!notifyModal}
        onClose={() => {
          setNotifyModal(null);
          setNotifyResult(null);
        }}
        onConfirm={(note) =>
          notifyModal && notifyMutation.mutate({ milestoneId: notifyModal.milestoneId, note })
        }
        loading={notifyMutation.isPending}
        milestoneLabel={notifyModal?.label || ""}
        amount={notifyModal?.amount || ""}
        clientName={notifyResult?.clientName || notifyModal?.clientName || ""}
        clientEmail={notifyResult?.clientEmail || notifyModal?.clientEmail}
        billingUrl={notifyResult?.billingUrl}
        notificationText={notifyResult?.notificationText}
        whatsappUrl={notifyResult?.whatsappUrl}
        mailtoUrl={notifyResult?.mailtoUrl}
      />
    </div>
  );
}
