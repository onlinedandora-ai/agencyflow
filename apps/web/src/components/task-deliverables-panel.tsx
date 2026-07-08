"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, ExternalLink, Link2, Mail, Share2, Upload, XCircle } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type TaskDeliverable } from "@/lib/api";
import { canManageTasks, canReviewDeliverables } from "@/lib/task-utils";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Awaiting manager review",
  APPROVED: "Approved",
  REJECTED: "Needs revision",
  SHARED: "Shared with client",
  CLIENT_APPROVED: "Client approved",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_REVIEW: "bg-amber-50 text-amber-800",
  APPROVED: "bg-green-50 text-green-800",
  REJECTED: "bg-red-50 text-red-800",
  SHARED: "bg-indigo-50 text-indigo-800",
  CLIENT_APPROVED: "bg-green-50 text-green-900",
};

export function TaskDeliverablesPanel({
  taskId,
  token,
  userRole,
  projectId,
}: {
  taskId: string;
  token: string;
  userRole: string;
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const canReview = canReviewDeliverables(userRole);
  const canSubmit = canReview || userRole === "DELIVERY_EXEC" || userRole === "ADMIN";

  const [mode, setMode] = useState<"link" | "document" | null>(null);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<{ dataUrl: string; name: string; mime: string } | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [shareResult, setShareResult] = useState<{ id: string; url: string; mailto?: string | null; whatsapp: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: deliverables = [], isLoading } = useQuery({
    queryKey: ["task-deliverables", taskId],
    queryFn: () => api.getTaskDeliverables(token, taskId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["task-deliverables", taskId] });
    queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
    queryClient.invalidateQueries({ queryKey: ["pending-deliverables"] });
  };

  const createMutation = useMutation({
    mutationFn: () => {
      if (mode === "link") {
        return api.createTaskDeliverable(token, taskId, { type: "LINK", label, url });
      }
      if (!file) throw new Error("No file");
      return api.createTaskDeliverable(token, taskId, {
        type: "DOCUMENT",
        label: label || file.name,
        fileName: file.name,
        mimeType: file.mime,
        fileDataUrl: file.dataUrl,
      });
    },
    onSuccess: () => {
      setMode(null);
      setLabel("");
      setUrl("");
      setFile(null);
      invalidate();
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.submitTaskDeliverable(token, taskId, id),
    onSuccess: invalidate,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveTaskDeliverable(token, taskId, id),
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.rejectTaskDeliverable(token, taskId, id, rejectNote[id] || ""),
    onSuccess: invalidate,
  });

  const shareMutation = useMutation({
    mutationFn: (id: string) => api.shareTaskDeliverable(token, taskId, id),
    onSuccess: (res) => {
      setShareResult({
        id: res.deliverable.id,
        url: res.publicUrl || "",
        mailto: res.mailto,
        whatsapp: res.whatsapp,
      });
      invalidate();
    },
  });

  function handleFile(f: File | null) {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () =>
      setFile({ dataUrl: reader.result as string, name: f.name, mime: f.type || "application/octet-stream" });
    reader.readAsDataURL(f);
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deliverables</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload documents or paste video/Drive links → submit for manager review → share with client.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading deliverables...</p>
      ) : (
        <div className="space-y-2">
          {deliverables.map((d) => (
            <DeliverableRow
              key={d.id}
              d={d}
              canSubmit={canSubmit}
              canReview={canReview}
              rejectNote={rejectNote[d.id] ?? ""}
              onRejectNoteChange={(v) => setRejectNote((n) => ({ ...n, [d.id]: v }))}
              onSubmit={() => submitMutation.mutate(d.id)}
              onApprove={() => approveMutation.mutate(d.id)}
              onReject={() => rejectMutation.mutate(d.id)}
              onShare={() => shareMutation.mutate(d.id)}
              shareResult={shareResult?.id === d.id ? shareResult : null}
              onCopy={copyLink}
              copied={copied}
            />
          ))}
          {deliverables.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No deliverables yet. Add a document or external link below.
            </p>
          )}
        </div>
      )}

      {canSubmit && (
        <div className="space-y-3 rounded-xl border border-white/50 bg-white/40 p-3">
          {!mode && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setMode("link")}>
                <Link2 className="h-4 w-4" /> Add link
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setMode("document")}>
                <Upload className="h-4 w-4" /> Upload document
              </Button>
            </div>
          )}
          {mode === "link" && (
            <div className="space-y-2">
              <Input placeholder="Label (e.g. Final video — YouTube)" value={label} onChange={(e) => setLabel(e.target.value)} />
              <Input placeholder="https://drive.google.com/... or video URL" value={url} onChange={(e) => setUrl(e.target.value)} />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => createMutation.mutate()} disabled={!url || createMutation.isPending}>
                  Save link
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
              </div>
            </div>
          )}
          {mode === "document" && (
            <div className="space-y-2">
              <Input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
              <label className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed p-4 text-center text-sm">
                <Upload className="h-5 w-5 text-primary" />
                <span className="mt-1">{file ? file.name : "Choose PDF, image, or doc (max ~2 MB)"}</span>
                <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
              </label>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => createMutation.mutate()} disabled={!file || createMutation.isPending}>
                  Upload
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeliverableRow({
  d,
  canSubmit,
  canReview,
  rejectNote,
  onRejectNoteChange,
  onSubmit,
  onApprove,
  onReject,
  onShare,
  shareResult,
  onCopy,
  copied,
}: {
  d: TaskDeliverable;
  canSubmit: boolean;
  canReview: boolean;
  rejectNote: string;
  onRejectNoteChange: (v: string) => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onShare: () => void;
  shareResult: { url: string; mailto?: string | null; whatsapp: string } | null;
  onCopy: (url: string) => void;
  copied: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/50 bg-white/50 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{d.label}</p>
          <p className="text-xs text-muted-foreground">{d.type === "LINK" ? "External link" : d.fileName || "Document"}</p>
          {d.url && (
            <a href={d.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
              Open link <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[d.status] || "bg-slate-100")}>
          {STATUS_LABELS[d.status] || d.status}
        </span>
      </div>

      {d.reviewNote && d.status === "REJECTED" && (
        <Alert className="mt-2 border-red-200/60 bg-red-50/40 py-2">
          <AlertDescription className="text-xs text-red-900">{d.reviewNote}</AlertDescription>
        </Alert>
      )}

      {d.clientFeedback && (
        <p className="mt-2 text-xs text-muted-foreground">Client: {d.clientFeedback}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {canSubmit && (d.status === "DRAFT" || d.status === "REJECTED") && (
          <Button type="button" size="sm" onClick={onSubmit}>Submit for approval</Button>
        )}
        {canReview && d.status === "PENDING_REVIEW" && (
          <>
            <Button type="button" size="sm" onClick={onApprove}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </Button>
            <Input className="h-8 w-full min-w-0 text-xs sm:max-w-[180px]" placeholder="Rejection reason" value={rejectNote} onChange={(e) => onRejectNoteChange(e.target.value)} />
            <Button type="button" size="sm" variant="outline" onClick={onReject} disabled={!rejectNote.trim()}>
              <XCircle className="h-3.5 w-3.5" /> Reject
            </Button>
          </>
        )}
        {canReview && (d.status === "APPROVED" || d.status === "SHARED") && (
          <Button type="button" size="sm" variant="outline" onClick={onShare}>
            <Share2 className="h-3.5 w-3.5" /> {d.status === "SHARED" ? "Re-share link" : "Share with client"}
          </Button>
        )}
        {d.publicUrl && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onCopy(d.publicUrl!)}>
            <Copy className="h-3.5 w-3.5" /> {copied ? "Copied!" : "Copy client link"}
          </Button>
        )}
      </div>

      {shareResult && (
        <div className="mt-3 rounded-lg border border-indigo-200/60 bg-indigo-50/40 p-3 text-xs">
          <p className="font-medium text-primary">Client review link ready</p>
          <p className="mt-1 break-all font-mono">{shareResult.url}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {shareResult.mailto && (
              <a href={shareResult.mailto} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-white/60">
                <Mail className="h-3.5 w-3.5" /> Email client
              </a>
            )}
            <a href={shareResult.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-white/60">
              WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
