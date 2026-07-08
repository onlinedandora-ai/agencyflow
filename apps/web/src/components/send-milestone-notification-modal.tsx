"use client";

import { Bell, Copy, ExternalLink, MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";

type SendMilestoneNotificationModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (internalNote?: string) => void;
  loading: boolean;
  milestoneLabel: string;
  amount: string;
  clientName: string;
  clientEmail?: string | null;
  billingUrl?: string | null;
  notificationText?: string;
  whatsappUrl?: string | null;
  mailtoUrl?: string | null;
};

export function SendMilestoneNotificationModal({
  open,
  onClose,
  onConfirm,
  loading,
  milestoneLabel,
  amount,
  clientName,
  clientEmail,
  billingUrl,
  notificationText,
  whatsappUrl,
  mailtoUrl,
}: SendMilestoneNotificationModalProps) {
  const [copied, setCopied] = useState(false);
  const [internalNote, setInternalNote] = useState("");

  if (!open) return null;

  async function copyMessage() {
    if (notificationText) {
      await navigator.clipboard.writeText(notificationText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Bell className="h-5 w-5 text-[var(--color-primary)]" />
              Send payment notification
            </h2>
            <p className="text-sm text-[var(--color-muted)]">
              {milestoneLabel} · ₹{amount} · {clientName}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--color-muted)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {notificationText ? (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                Message preview
              </p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6">{notificationText}</pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyMessage}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied!" : "Copy message"}
                </button>
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-green-700"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                )}
                {mailtoUrl && clientEmail && (
                  <a
                    href={mailtoUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium"
                  >
                    Email
                  </a>
                )}
                {billingUrl && (
                  <a
                    href={billingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Billing link
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              Log the notification and get share links for WhatsApp or email.
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Internal note (optional)</label>
            <input
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="e.g. Sent after client call"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            {notificationText ? "Close" : "Cancel"}
          </button>
          {!notificationText && (
            <button
              type="button"
              onClick={() => onConfirm(internalNote || undefined)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {loading ? "Preparing..." : "Prepare & share"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
