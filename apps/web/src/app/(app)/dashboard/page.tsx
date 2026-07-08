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
        <p className="text-sm text-muted-foreground">Portfolio overview — MVP slice</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active leads", stats?.total ?? "—"],
          ["Closed won rate", stats ? `${stats.conversionRate}%` : "—"],
          ["SLA breaches", stats?.slaBreaches ?? "—"],
          ["Needs first response", stats?.awaitingFirstResponse ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="glass-panel p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold">MVP progress</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li className="text-green-600">✓ CRM lead pipeline with SLA + drag-and-drop</li>
          <li className="text-green-600">✓ Discovery call sheet (10 questions)</li>
          <li className="text-green-600">✓ Proposal builder (6 sections, word limit, 24h timer)</li>
          <li className="text-green-600">✓ Client onboarding + advance-payment gate</li>
          <li className="text-green-600">✓ Task boards by service line (Kanban + gate)</li>
          <li className="text-green-600">✓ Delivery QA gate + revision round tracking</li>
          <li className="text-green-600">✓ Client portal — SOP intake forms (onboarding, brand, access)</li>
          <li className="text-green-600">✓ Razorpay online payments + bank transfer fallback</li>
          <li>○ Workflow automation engine (BullMQ)</li>
          <li>○ Reports &amp; Settings pages</li>
        </ul>
      </div>
    </div>
  );
}
