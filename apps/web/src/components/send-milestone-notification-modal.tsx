"use client";

import { Bell, Copy, ExternalLink, MessageCircle, Send } from "lucide-react";
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

  async function copyMessage() {
    if (notificationText) {
      await navigator.clipboard.writeText(notificationText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg" showCloseButton>
        <DialogHeader className="border-b border-white/40 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Send payment notification
          </DialogTitle>
          <DialogDescription>
            {milestoneLabel} · ₹{amount} · {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          {notificationText ? (
            <div className="glass-callout">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Message preview</p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6">{notificationText}</pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={copyMessage}>
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied!" : "Copy message"}
                </Button>
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-green-700")}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                )}
                {mailtoUrl && clientEmail && (
                  <a href={mailtoUrl} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    Email
                  </a>
                )}
                {billingUrl && (
                  <a
                    href={billingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Billing link
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Log the notification and get share links for WhatsApp or email.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="milestone-internal-note">Internal note (optional)</Label>
            <Input
              id="milestone-internal-note"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="e.g. Sent after client call"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-white/40 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {notificationText ? "Close" : "Cancel"}
          </Button>
          {!notificationText && (
            <Button type="button" onClick={() => onConfirm(internalNote || undefined)} disabled={loading}>
              <Send className="h-4 w-4" />
              {loading ? "Preparing..." : "Prepare & share"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
