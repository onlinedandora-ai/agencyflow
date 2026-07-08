"use client";

import { MessageSquare, RefreshCw, Send } from "lucide-react";
import type { ProposalHistory, ProposalRevisionRequest, ProposalSendLog } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  ADDRESSED: "Addressed",
};

export function ProposalActivityTimeline({ history }: { history: ProposalHistory }) {
  type TimelineItem =
    | { type: "send"; date: string; data: ProposalSendLog }
    | { type: "revision"; date: string; data: ProposalRevisionRequest };

  const items: TimelineItem[] = [
    ...history.sendLogs.map((log) => ({ type: "send" as const, date: log.sentAt, data: log })),
    ...history.revisionRequests.map((rev) => ({
      type: "revision" as const,
      date: rev.requestedAt,
      data: rev,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No send or revision activity yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        if (item.type === "send") {
          const log = item.data;
          return (
            <div
              key={`send-${log.id}`}
              className="flex gap-3 glass-panel p-4"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-primary">
                {log.isResend ? <RefreshCw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {log.isResend ? `Resent v${log.version}` : `Sent v${log.version}`}
                  {log.sentBy?.name ? ` · ${log.sentBy.name}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(log.sentAt).toLocaleString("en-IN")}
                </p>
                {log.internalNote && (
                  <p className="mt-1 text-xs text-muted-foreground">Note: {log.internalNote}</p>
                )}
              </div>
            </div>
          );
        }

        const rev = item.data;
        return (
          <div
            key={`rev-${rev.id}`}
            className="flex gap-3 rounded-lg border border-amber-100 bg-amber-50/40 p-4"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                Revision requested on v{rev.versionAtRequest} · {STATUS_LABELS[rev.status]}
              </p>
              <p className="text-xs text-muted-foreground">
                {rev.requestedByName} · {new Date(rev.requestedAt).toLocaleString("en-IN")}
              </p>
              <p className="mt-2 text-sm leading-6">{rev.comments}</p>
              {rev.addressedInVersion && (
                <p className="mt-1 text-xs text-green-600">
                  Addressed in v{rev.addressedInVersion}
                  {rev.addressedAt && ` · ${new Date(rev.addressedAt).toLocaleString("en-IN")}`}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
