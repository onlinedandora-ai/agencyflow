"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, ExternalLink } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  PublicErrorState,
  PublicLoadingState,
  PublicPageLayout,
} from "@/components/public-page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export default function PublicDeliverablePage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [done, setDone] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-deliverable", token],
    queryFn: () => api.getPublicDeliverable(token),
  });

  const feedbackMutation = useMutation({
    mutationFn: (approved: boolean) =>
      api.submitDeliverableFeedback(token, { feedback, approved }),
    onSuccess: () => {
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["public-deliverable", token] });
    },
  });

  if (isLoading) return <PublicLoadingState message="Loading deliverable..." />;
  if (error || !data) return <PublicErrorState message="Deliverable not found or no longer available." />;

  const workspace = data.task?.project?.workspace;
  const approved = data.status === "CLIENT_APPROVED";

  return (
    <PublicPageLayout>
      <div className="glass-panel-strong p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Deliverable review</p>
        <h1 className="mt-1 text-2xl font-semibold">{data.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.task?.title} · {data.task?.project?.name}
        </p>
        {workspace && (
          <p className="text-sm text-muted-foreground">{workspace.company || workspace.name}</p>
        )}
      </div>

      <div className="glass-panel mt-6 p-6">
        <h2 className="font-semibold">Your deliverable</h2>
        {data.type === "LINK" && data.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Open {data.label}
          </a>
        )}
        {data.type === "DOCUMENT" && data.fileDataUrl && (
          <div className="mt-4 space-y-3">
            <a
              href={data.fileDataUrl}
              download={data.fileName || "deliverable"}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium"
            >
              <Download className="h-4 w-4" />
              Download {data.fileName}
            </a>
            {data.mimeType?.startsWith("image/") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.fileDataUrl} alt={data.label || "Deliverable"} className="max-h-96 rounded-lg border" />
            )}
          </div>
        )}
      </div>

      {approved ? (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50/60 p-4 text-sm text-green-800">
          <CheckCircle2 className="h-5 w-5" />
          Approved — thank you!
          {data.clientFeedback && <span className="text-muted-foreground">({data.clientFeedback})</span>}
        </div>
      ) : !done ? (
        <div className="glass-panel mt-6 p-6">
          <h2 className="font-semibold">Your feedback</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve if this meets expectations, or request changes with a short note.
          </p>
          <Input
            className="mt-4"
            placeholder="Optional comment"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => feedbackMutation.mutate(true)} disabled={feedbackMutation.isPending}>
              Approve deliverable
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => feedbackMutation.mutate(false)}
              disabled={!feedback.trim() || feedbackMutation.isPending}
            >
              Request changes
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-green-600">Feedback submitted — the team will follow up shortly.</p>
      )}
    </PublicPageLayout>
  );
}
