import type { AgencyProfile } from "@/lib/api";

export type InvoiceLineItem = { description: string; amount: number };

export type InvoiceDoc = {
  number: string;
  documentType: string;
  amount: string | number;
  description?: string | null;
  lineItems?: InvoiceLineItem[] | null;
  status: string;
  dueDate?: string | null;
  paidAt?: string | null;
  sentAt?: string | null;
  paymentMode?: string | null;
  paymentReference?: string | null;
  isAdvance?: boolean;
  workspace?: { name: string; company?: string | null; email?: string | null };
  relatedInvoice?: { number: string } | null;
};

const TYPE_TITLES: Record<string, string> = {
  DRAFT: "Draft Invoice",
  TAX: "Tax Invoice",
  RECEIPT: "Payment Receipt",
};

export function InvoiceDocument({
  invoice,
  agency,
}: {
  invoice: InvoiceDoc;
  agency: AgencyProfile;
}) {
  const title = TYPE_TITLES[invoice.documentType] || "Invoice";
  const issueDate = invoice.sentAt || invoice.paidAt || new Date().toISOString();
  const formattedDate = new Date(issueDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const lineItems =
    (invoice.lineItems as InvoiceLineItem[] | null) ||
    [{ description: invoice.description || "Services as per agreement", amount: Number(invoice.amount) }];
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.amount), 0);
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  return (
    <article className="invoice-document mx-auto w-full max-w-[800px] bg-white text-[var(--color-ink)] shadow-[0_4px_24px_rgba(11,16,32,0.08)]">
      <div className="h-1.5 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-primary)]" />

      <header className="border-b border-[var(--color-border)] px-10 pb-8 pt-10">
        <div className="flex items-start justify-between gap-8">
          <div>
            <p className="text-2xl font-semibold tracking-tight">{agency.name}</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{agency.tagline}</p>
            {agency.gstin && (
              <p className="mt-2 text-xs text-[var(--color-muted)]">GSTIN: {agency.gstin}</p>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
              {title}
            </p>
            <p className="mt-2 font-mono text-base font-semibold">{invoice.number}</p>
            <p className="mt-1 text-[var(--color-muted)]">Date: {formattedDate}</p>
            {invoice.documentType === "DRAFT" && (
              <p className="mt-2 text-xs text-amber-700">Not a tax invoice — for approval only</p>
            )}
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">Bill to</p>
            <p className="mt-2 font-semibold">{invoice.workspace?.name}</p>
            <p className="text-sm text-[var(--color-muted)]">{invoice.workspace?.company}</p>
            {invoice.workspace?.email && (
              <p className="mt-1 text-sm text-[var(--color-muted)]">{invoice.workspace.email}</p>
            )}
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">From</p>
            <p className="mt-2 font-semibold">{agency.name}</p>
            <p className="text-sm text-[var(--color-muted)]">{agency.address}</p>
            <p className="text-sm text-[var(--color-muted)]">{agency.email}</p>
          </div>
        </div>
      </header>

      <div className="px-10 py-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <th className="pb-3">Description</th>
              <th className="pb-3 text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} className="border-b border-[var(--color-border)]">
                <td className="py-3 pr-4">{item.description}</td>
                <td className="py-3 text-right font-mono">{Number(item.amount).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Subtotal</span>
            <span className="font-mono">₹{subtotal.toLocaleString("en-IN")}</span>
          </div>
          {invoice.documentType !== "DRAFT" && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">GST (18%)</span>
              <span className="font-mono">₹{gst.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="font-mono">
              ₹{(invoice.documentType === "DRAFT" ? subtotal : total).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {invoice.documentType === "RECEIPT" && invoice.relatedInvoice && (
          <p className="mt-6 text-sm text-[var(--color-muted)]">
            Payment received against invoice <strong>{invoice.relatedInvoice.number}</strong>
            {invoice.paymentMode && ` via ${invoice.paymentMode.replace(/_/g, " ")}`}
            {invoice.paymentReference && ` (Ref: ${invoice.paymentReference})`}
          </p>
        )}

        {invoice.dueDate && invoice.documentType === "TAX" && invoice.status !== "PAID" && (
          <p className="mt-6 text-sm text-[var(--color-muted)]">
            Due date: {new Date(invoice.dueDate).toLocaleDateString("en-IN")}
          </p>
        )}

        {agency.bankName && invoice.documentType !== "RECEIPT" && (
          <section className="mt-10 border-t border-[var(--color-border)] pt-8">
            <h2 className="text-sm font-semibold">Bank details</h2>
            <div className="mt-3 grid gap-1 font-mono text-sm text-[var(--color-muted)]">
              <p>{agency.bankName}</p>
              <p>A/C: {agency.bankAccount}</p>
              <p>IFSC: {agency.bankIfsc}</p>
            </div>
          </section>
        )}
      </div>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-10 py-6 text-center text-xs text-[var(--color-muted)]">
        {agency.name} {agency.gstin ? `· GSTIN ${agency.gstin}` : ""} · {agency.email}
      </footer>
    </article>
  );
}
