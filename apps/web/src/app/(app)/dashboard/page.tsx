"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { FileCheck } from "lucide-react";
import { StatTilesSkeleton } from "@/components/loading-skeletons";
import {
  QueryErrorBanner,
  QuerySlowBanner,
  useSlowQuery,
} from "@/components/query-load-state";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { STATS_STALE_TIME } from "@/lib/query-config";
import { canManageTasks, ROLE_LABELS } from "@/lib/task-utils";

export default function DashboardPage() {
  const token = useAuthStore((s) => s.token)!;
  const user = useAuthStore((s) => s.user);
  const isManager = canManageTasks(user?.role);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
    isFetching: statsFetching,
  } = useQuery({
    queryKey: ["pipeline-stats"],
    queryFn: () => api.getStats(token),
    staleTime: STATS_STALE_TIME,
  });

  const {
    data: pendingDeliverables = [],
    isLoading: deliverablesLoading,
    isError: deliverablesError,
    error: deliverablesErr,
    refetch: refetchDeliverables,
    isFetching: deliverablesFetching,
  } = useQuery({
    queryKey: ["pending-deliverables"],
    queryFn: () => api.getPendingDeliverables(token),
    enabled: isManager,
    staleTime: STATS_STALE_TIME,
  });

  const roleLabel = ROLE_LABELS[user?.role || ""] || user?.role;
  const statsBusy = statsLoading || statsFetching;
  const showStatsSkeleton = statsBusy && !stats && !statsError;
  const statsSlow = useSlowQuery(statsBusy);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Agency Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {roleLabel} view — pipeline, delivery queue, and workspace health
        </p>
      </div>

      {statsError ? (
        <QueryErrorBanner error={statsErr} onRetry={() => refetchStats()} retrying={statsFetching} />
      ) : showStatsSkeleton ? (
        <>
          {statsSlow && <QuerySlowBanner />}
          <StatTilesSkeleton />
        </>
      ) : (
        <div className="card-grid-stats">
          {[
            ["Active leads", stats?.total ?? "—"],
            ["Closed won rate", stats ? `${stats.conversionRate}%` : "—"],
            ["SLA breaches", stats?.slaBreaches ?? "—"],
            isManager
              ? ["Deliverables to review", deliverablesLoading ? "…" : pendingDeliverables.length]
              : ["Needs first response", stats?.awaitingFirstResponse ?? "—"],
          ].map(([label, value]) => (
            <div key={label} className="stat-tile">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="stat-value">{value}</p>
            </div>
          ))}
        </div>
      )}

      {isManager && deliverablesError && (
        <QueryErrorBanner
          error={deliverablesErr}
          onRetry={() => refetchDeliverables()}
          retrying={deliverablesFetching}
        />
      )}

      {isManager && pendingDeliverables.length > 0 && (
        <div className="glass-panel border-amber-200/60 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <FileCheck className="h-5 w-5 text-amber-700" />
            Deliverables awaiting your approval ({pendingDeliverables.length})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review uploads and links from the team, then approve and share with the client.
          </p>
          <div className="mt-4 space-y-3">
            {pendingDeliverables.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white/40 p-3 text-sm">
                <div>
                  <p className="font-medium">{d.label}</p>
                  <p className="text-muted-foreground">
                    {d.task?.title} · {d.task?.project?.workspace?.company || d.task?.project?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted by {d.submittedBy?.name} · {d.type === "LINK" ? "External link" : "Document"}
                  </p>
                </div>
                {d.task?.project?.id && (
                  <Link
                    href={`/projects/board/${d.task.project.id}`}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Open task board →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isManager && (
        <div className="glass-panel p-5">
          <h2 className="font-semibold">Your delivery work</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a project board, click your task, and upload documents or video/Drive links under Deliverables. Submit for manager approval when ready.
          </p>
          <Link href="/projects/list" className="mt-3 inline-block text-sm font-medium text-primary">
            Go to projects →
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-panel p-5">
          <h2 className="font-semibold">Delivery workflow</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="font-medium text-foreground">1.</span> Team uploads document or pastes link in task</li>
            <li className="flex gap-2"><span className="font-medium text-foreground">2.</span> Submit for manager approval</li>
            <li className="flex gap-2"><span className="font-medium text-foreground">3.</span> Manager approves → shares client review link (email / WhatsApp)</li>
            <li className="flex gap-2"><span className="font-medium text-foreground">4.</span> QA sign-off → move to client review on board</li>
          </ol>
        </div>
        <div className="glass-panel p-5">
          <h2 className="font-semibold">Quick links</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/pipeline" className="text-primary">Pipeline</Link></li>
            <li><Link href="/projects/list" className="text-primary">Projects &amp; task boards</Link></li>
            <li><Link href="/clients" className="text-primary">Clients &amp; payment review</Link></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
