"use client";

import { Copy, ExternalLink, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg" showCloseButton>
        <DialogHeader className="border-b border-white/40 px-6 py-4">
          <DialogTitle>{isResend ? `Resend proposal v${version + 1}` : "Send proposal"}</DialogTitle>
          <DialogDescription>Share the client link — your call to action</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="glass-callout">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Client proposal link</p>
            <p className="mt-2 break-all font-mono text-sm">{clientUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <a
                href={clientUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Preview
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-green-700")}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </a>
              {clientEmail && (
                <a href={mailtoUrl} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Email
                </a>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proposal-internal-note">Internal note (optional)</Label>
            <Input
              id="proposal-internal-note"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="e.g. Sent after discovery call"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-white/40 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(internalNote || undefined)}
            disabled={loading}
          >
            <Send className="h-4 w-4" />
            {loading ? "Sending..." : isResend ? `Resend v${version + 1}` : "Send proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
