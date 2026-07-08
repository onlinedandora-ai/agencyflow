"use client";

import { Copy, ExternalLink, MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";

type SendProposalModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (internalNote?: string) => void;
  loading: boolean;
  clientUrl: string;
  clientName: string;
  clientEmail?: string | null;
  isResend: boolean;
  version: number;
};

export function SendProposalModal({
  open,
  onClose,
  onConfirm,
  loading,
  clientUrl,
  clientName,
  clientEmail,
  isResend,
  version,
}: SendProposalModalProps) {
  const [copied, setCopied] = useState(false);
  const [internalNote, setInternalNote] = useState("");

  if (!open) return null;

  const whatsappText = encodeURIComponent(
    `Hi ${clientName}, please review our project proposal here: ${clientUrl}`,
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;
  const mailtoUrl = `mailto:${clientEmail || ""}?subject=${encodeURIComponent("Your project proposal")}&body=${encodeURIComponent(`Hi ${clientName},\n\nPlease review our proposal:\n${clientUrl}\n\nLooking forward to your feedback.`)}`;

  async function copyLink() {
    await navigator.clipboard.writeText(clientUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {isResend ? `Resend proposal v${version + 1}` : "Send proposal"}
            </h2>
            <p className="text-sm text-[var(--color-muted)]">
              Share the client link — your call to action
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--color-muted)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
              Client proposal link
            </p>
            <p className="mt-2 break-all font-mono text-sm">{clientUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy link"}
              </button>
              <a
                href={clientUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Preview
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-green-700"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </a>
              {clientEmail && (
                <a
                  href={mailtoUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium"
                >
                  Email
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Internal note (optional)</label>
            <input
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="e.g. Sent after discovery call"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(internalNote || undefined)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {loading ? "Sending..." : isResend ? `Resend v${version + 1}` : "Send proposal"}
          </button>
        </div>
      </div>
    </div>
  );
}
