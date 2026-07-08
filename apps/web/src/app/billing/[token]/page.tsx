"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Download, FileText } from "lucide-react";
import { InvoiceDocument } from "@/components/invoice-document";
import { api, cn } from "@/lib/api";

export default function BillingPortalPage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [requested, setRequested] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["billing", token],
    queryFn: () => api.getBillingPortal(token),
  });

  const requestMutation = useMutation({
    mutationFn: () => api.requestTaxInvoice(token, { requestedByName: name, requestedByEmail: email }),
    onSuccess: () => {
      setRequested(true);
      queryClient.invalidateQueries({ queryKey: ["billing", token] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <p className="text-sm text-[var(--color-muted)]">Loading billing portal...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <p className="text-sm text-[var(--color-danger)]">Billing link not found.</p>
      </div>
    );
  }

  const isDraftFirst = data.workspace.billingFlow === "DRAFT_FIRST";

  return (
    <div className="min-h-screen bg-[var(--color-bg)] py-10">
      <div className="mx-auto max-w-[800px] px-4">
        <div className="no-print mb-8 rounded-xl border bg-white p-6">
          <h1 className="text-2xl font-semibold">{data.workspace.company || data.workspace.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Billing portal</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {data.steps.map((step) => (
              <span
                key={step.key}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  step.done
                    ? "bg-green-50 text-green-800"
                    : step.active
                      ? "bg-indigo-50 text-[var(--color-primary)]"
                      : "bg-[var(--color-bg)] text-[var(--color-muted)]"
                }`}
              >
                {step.done && "✓ "}
                {step.label}
              </span>
            ))}
          </div>
        </div>

        {data.draftInvoice && (
          <div className="no-print mb-6 rounded-xl border bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <FileText className="h-5 w-5 text-[var(--color-primary)]" />
                  Draft invoice — {data.draftInvoice.number}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Review and download. This is not a tax invoice.
                </p>
              </div>
              <a
                href={`/billing/doc/${data.draftInvoice.publicToken}?print=1`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            </div>
          </div>
        )}

        {isDraftFirst && !data.taxInvoice && !data.pendingTaxRequest && !requested && data.draftInvoice && (
          <div className="no-print mb-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-6">
            <h2 className="font-semibold">Ready for tax invoice?</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Once you&apos;re happy with the draft invoice, request your formal tax invoice here.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border bg-white px-3 py-2 text-sm"
              />
              <input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => requestMutation.mutate()}
              disabled={!name || requestMutation.isPending}
              className="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {requestMutation.isPending ? "Submitting..." : "Request tax invoice"}
            </button>
          </div>
        )}

        {(data.pendingTaxRequest || requested) && !data.taxInvoice && (
          <div className="no-print mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Tax invoice requested. We&apos;ll issue it shortly and notify you on this page.
          </div>
        )}

        {data.milestones.length > 0 && (
          <div className="no-print mb-6 rounded-xl border bg-white p-6">
            <h2 className="font-semibold">Payment schedule</h2>
            <div className="mt-4 space-y-2">
              {data.milestones.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-4 py-3 text-sm",
                    m.status === "PAID" ? "border-green-200 bg-green-50/50" : "border-[var(--color-border)]",
                  )}
                >
                  <span>{m.label}</span>
                  <span className="font-medium">
                    ₹{Number(m.amount).toLocaleString("en-IN")}
                    {m.status === "PAID" ? " · Paid ✓" : " · Due"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.taxInvoice && (
          <div className="no-print mb-6 rounded-xl border bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">Tax invoice — {data.taxInvoice.number}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Status: {data.taxInvoice.status}
                  {data.taxInvoice.amountDue !== undefined && data.taxInvoice.amountDue > 0 && (
                    <> · ₹{data.taxInvoice.amountDue.toLocaleString("en-IN")} remaining</>
                  )}
                </p>
              </div>
              <a
                href={`/billing/doc/${data.taxInvoice.publicToken}?print=1`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            </div>
            {data.taxInvoice.status === "PAID" && (
              <p className="mt-3 flex items-center gap-2 text-sm text-[var(--color-success)]">
                <CheckCircle2 className="h-4 w-4" />
                Payment received — thank you!
              </p>
            )}
          </div>
        )}

        {data.receipts.length > 0 && (
          <div className="no-print mb-6 space-y-3">
            <h2 className="font-semibold">Payment receipts</h2>
            {data.receipts.map((receipt) => (
              <div key={receipt.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
                <span className="text-sm font-medium">{receipt.number}</span>
                <a
                  href={`/billing/doc/${receipt.publicToken}?print=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-[var(--color-primary)]"
                >
                  Download receipt
                </a>
              </div>
            ))}
          </div>
        )}

        {data.draftInvoice && (
          <div className="print-only">
            <InvoiceDocument invoice={data.draftInvoice} agency={data.agency} />
          </div>
        )}
      </div>
    </div>
  );
}
