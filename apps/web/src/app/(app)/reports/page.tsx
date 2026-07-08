"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Activity, AlertTriangle, IndianRupee, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const HEALTH_COLORS: Record<string, string> = {
  green: "bg-green-100 text-green-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
};

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function ReportsPage() {
  const token = useAuthStore((s) => s.token)!;

  const { data, isLoading } = useQuery({
    queryKey: ["reports-overview"],
    queryFn: () => api.getReportsOverview(token),
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Loading reports…</p>;
  }

  const pipeline = data?.pipeline;
  const revenue = data?.revenue;
  const projects = data?.projects ?? [];
  const deliverables = data?.deliverables;
  const runs = data?.automation?.recentRuns ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="text-sm text-muted-foreground">Pipeline, revenue, delivery health, and automation activity</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
        {[
          { label: "Active leads", value: pipeline?.total ?? "—", icon: TrendingUp },
          { label: "Win rate", value: pipeline ? `${pipeline.conversionRate}%` : "—", icon: TrendingUp },
          { label: "Collected", value: revenue ? formatInr(revenue.collected) : "—", icon: IndianRupee },
          { label: "Outstanding", value: revenue ? formatInr(revenue.outstanding) : "—", icon: IndianRupee },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass-panel p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="stat-value">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-panel p-5">
          <h2 className="font-semibold">Pipeline alerts</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-muted-foreground">SLA breaches</span>
              <span className="font-medium text-red-700">{pipeline?.slaBreaches ?? 0}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Awaiting first response</span>
              <span className="font-medium">{pipeline?.awaitingFirstResponse ?? 0}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Proposal follow-ups overdue</span>
              <span className="font-medium text-amber-700">{data?.overdueProposals ?? 0}</span>
            </li>
          </ul>
          <Link href="/pipeline" className="mt-3 inline-block text-sm text-primary">Open pipeline →</Link>
        </div>

        <div className="glass-panel p-5">
          <h2 className="font-semibold">Revenue</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-muted-foreground">Paid invoices</span>
              <span>{revenue?.paidCount ?? 0}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Overdue invoices</span>
              <span className="text-red-700">{revenue?.overdueCount ?? 0}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Overdue amount</span>
              <span className="font-medium">{revenue ? formatInr(revenue.overdueAmount) : "—"}</span>
            </li>
          </ul>
          <Link href="/invoices" className="mt-3 inline-block text-sm text-primary">Open invoices →</Link>
        </div>

        <div className="glass-panel p-5">
          <h2 className="font-semibold">Deliverables</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-muted-foreground">Pending manager review</span>
              <span>{deliverables?.pendingReview ?? 0}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Awaiting client</span>
              <span>{deliverables?.awaitingClient ?? 0}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Client approved</span>
              <span className="text-green-700">{deliverables?.clientApproved ?? 0}</span>
            </li>
          </ul>
          <Link href="/dashboard" className="mt-3 inline-block text-sm text-primary">Delivery queue →</Link>
        </div>
      </div>

      <div className="glass-panel p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-5 w-5 text-amber-700" />
          Project health
        </h2>
        {projects.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No active projects.</p>
        ) : (
          <>
            <div className="mt-4 space-y-3 md:hidden">
              {projects.map((p) => (
                <div key={p.id} className="rounded-xl border border-white/40 bg-white/30 p-3 text-sm">
                  <Link href={`/projects/${p.id}/board`} className="font-medium text-primary">
                    {p.name}
                  </Link>
                  <p className="mt-1 text-muted-foreground">{p.client}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span>{p.progressPercent}% complete</span>
                    <span>·</span>
                    <span>{p.overdueCount} overdue</span>
                    <span className={`rounded-full px-2 py-0.5 ${HEALTH_COLORS[p.health] || ""}`}>
                      {p.health}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Project</th>
                  <th className="pb-2 pr-4">Client</th>
                  <th className="pb-2 pr-4">Progress</th>
                  <th className="pb-2 pr-4">Overdue</th>
                  <th className="pb-2">Health</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-white/20">
                    <td className="py-2 pr-4">
                      <Link href={`/projects/${p.id}/board`} className="font-medium text-primary">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{p.client}</td>
                    <td className="py-2 pr-4">{p.progressPercent}%</td>
                    <td className="py-2 pr-4">{p.overdueCount}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${HEALTH_COLORS[p.health] || ""}`}>
                        {p.health}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      <div className="glass-panel p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Activity className="h-5 w-5" />
          Recent automation runs
        </h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No automation runs yet. Jobs start on the next schedule tick.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border bg-white/30 px-3 py-2">
                <div>
                  <p className="font-medium">{run.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {run.jobType.replace(/_/g, " ")} · {run.status} · {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link href="/settings" className="mt-3 inline-block text-sm text-primary">Workflow settings →</Link>
      </div>
    </div>
  );
}
