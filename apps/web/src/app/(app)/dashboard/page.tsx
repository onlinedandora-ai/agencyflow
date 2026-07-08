"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function DashboardPage() {
  const token = useAuthStore((s) => s.token)!;

  const { data: stats } = useQuery({
    queryKey: ["pipeline-stats"],
    queryFn: () => api.getStats(token),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Agency Dashboard</h1>
        <p className="text-sm text-[var(--color-muted)]">Portfolio overview — MVP slice</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active leads", stats?.total ?? "—"],
          ["Closed won rate", stats ? `${stats.conversionRate}%` : "—"],
          ["SLA breaches", stats?.slaBreaches ?? "—"],
          ["Needs first response", stats?.awaitingFirstResponse ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[var(--color-border)] bg-white p-5">
            <p className="text-sm text-[var(--color-muted)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
        <h2 className="text-lg font-semibold">MVP progress</h2>
        <ul className="mt-4 space-y-2 text-sm text-[var(--color-muted)]">
          <li className="text-[var(--color-success)]">✓ CRM lead pipeline with SLA + drag-and-drop</li>
          <li className="text-[var(--color-success)]">✓ Discovery call sheet (10 questions)</li>
          <li className="text-[var(--color-success)]">✓ Proposal builder (6 sections, word limit, 24h timer)</li>
          <li className="text-[var(--color-success)]">✓ Client onboarding + advance-payment gate</li>
          <li className="text-[var(--color-success)]">✓ Task boards by service line (Kanban + gate)</li>
          <li>○ Delivery + revision round tracking (next)</li>
          <li>○ Invoicing + Razorpay integration</li>
          <li>○ Workflow automation engine (BullMQ)</li>
        </ul>
      </div>
    </div>
  );
}
