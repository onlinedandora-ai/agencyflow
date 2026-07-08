"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, type Lead } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  DISCOVERY_SCHEDULED: "Discovery",
  PROPOSAL_SENT: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Won",
  CLOSED_LOST: "Lost",
  NURTURE: "Nurture",
};

const SOURCES = ["MANUAL", "WEB_FORM", "REFERRAL", "WHATSAPP", "OTHER"] as const;

type LeadEditDialogProps = {
  open: boolean;
  lead: Lead | null;
  token: string;
  onClose: () => void;
};

export function LeadEditDialog({ open, lead, token, onClose }: LeadEditDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    source: "MANUAL",
    stage: "NEW",
    notes: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (lead) {
      setForm({
        name: lead.name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        company: lead.company || "",
        source: lead.source || "MANUAL",
        stage: lead.stage || "NEW",
        notes: lead.notes || "",
      });
      setError("");
    }
  }, [lead]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const data: Record<string, string> = {
        name: form.name,
        source: form.source,
        stage: form.stage,
      };
      if (form.email) data.email = form.email;
      if (form.phone) data.phone = form.phone;
      if (form.company) data.company = form.company;
      if (form.notes) data.notes = form.notes;
      return api.updateLead(token, lead!.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-stats"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit lead</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="lead-name">Name</Label>
            <Input
              id="lead-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-company">Company</Label>
            <Input
              id="lead-company"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="lead-source">Source</Label>
              <select
                id="lead-source"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className="w-full rounded-lg border bg-white/50 px-3 py-2 text-sm"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lead-stage">Stage</Label>
              <select
                id="lead-stage"
                value={form.stage}
                onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
                className="w-full rounded-lg border bg-white/50 px-3 py-2 text-sm"
              >
                {Object.entries(STAGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea
              id="lead-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!form.name.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
