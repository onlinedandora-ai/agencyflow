"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Cog, Play, Server, Users } from "lucide-react";
import Link from "next/link";
import { api, type WorkflowSettings } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { canManageTasks, isAdmin } from "@/lib/task-utils";
import { Button } from "@/components/ui/button";

const JOB_LABELS: Record<string, string> = {
  lead_sla_scan: "Lead SLA scan (every 5 min)",
  proposal_followup: "Proposal follow-up (hourly)",
  invoice_overdue: "Invoice overdue (daily 9am)",
  deliverable_review_nudge: "Deliverable review nudge (every 15 min)",
};

export default function SettingsPage() {
  const token = useAuthStore((s) => s.token)!;
  const user = useAuthStore((s) => s.user);
  const isManager = canManageTasks(user?.role);
  const admin = isAdmin(user?.role);
  const queryClient = useQueryClient();

  const [agency, setAgency] = useState({
    name: "",
    tagline: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    gstin: "",
    bankName: "",
    bankAccount: "",
    bankIfsc: "",
    defaultTermsAndConditions: "",
  });

  const { data: profile } = useQuery({
    queryKey: ["agency-profile"],
    queryFn: () => api.getAgencyProfile(token),
    enabled: isManager,
  });

  const { data: workflow } = useQuery({
    queryKey: ["workflow-settings"],
    queryFn: () => api.getWorkflowSettings(token),
    enabled: isManager,
  });

  const { data: automationStatus } = useQuery({
    queryKey: ["automation-status"],
    queryFn: () => api.getAutomationStatus(token),
    enabled: isManager,
  });

  const { data: automationRuns = [] } = useQuery({
    queryKey: ["automation-runs"],
    queryFn: () => api.getAutomationRuns(token),
    enabled: isManager,
  });

  useEffect(() => {
    if (profile) {
      setAgency({
        name: profile.name || "",
        tagline: profile.tagline || "",
        email: profile.email || "",
        phone: profile.phone || "",
        website: profile.website || "",
        address: profile.address || "",
        city: profile.city || "",
        gstin: profile.gstin || "",
        bankName: profile.bankName || "",
        bankAccount: profile.bankAccount || "",
        bankIfsc: profile.bankIfsc || "",
        defaultTermsAndConditions: profile.defaultTermsAndConditions || "",
      });
    }
  }, [profile]);

  const [workflowForm, setWorkflowForm] = useState<WorkflowSettings>({
    enabled: true,
    leadSlaScan: true,
    proposalFollowUp: true,
    invoiceOverdue: true,
    deliverableReviewNudge: true,
  });

  useEffect(() => {
    if (workflow) setWorkflowForm(workflow);
  }, [workflow]);

  const saveAgencyMutation = useMutation({
    mutationFn: () => api.updateAgencyProfile(token, agency),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agency-profile"] }),
  });

  const saveWorkflowMutation = useMutation({
    mutationFn: () => api.updateWorkflowSettings(token, workflowForm),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-settings"] }),
  });

  const triggerMutation = useMutation({
    mutationFn: (jobType: string) => api.triggerAutomation(token, jobType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-runs"] });
      queryClient.invalidateQueries({ queryKey: ["reports-overview"] });
    },
  });

  if (!isManager) {
    return (
      <div className="glass-panel p-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Only admins and client managers can edit agency settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-muted-foreground">Agency profile, bank details, and workflow automation</p>
      </div>

      {admin && (
        <Link
          href="/settings/team"
          className="glass-panel flex items-center justify-between p-5 transition hover:bg-white/60"
        >
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Users className="h-5 w-5" />
              Team
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Create users and manage team member roles</p>
          </div>
          <span className="text-sm text-primary">Manage →</span>
        </Link>
      )}

      <div className="glass-panel p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Cog className="h-5 w-5" />
          Agency profile
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(
            [
              ["name", "Agency name"],
              ["tagline", "Tagline"],
              ["email", "Email"],
              ["phone", "Phone"],
              ["website", "Website"],
              ["address", "Address"],
              ["city", "City"],
              ["gstin", "GSTIN"],
              ["bankName", "Bank name"],
              ["bankAccount", "Bank account"],
              ["bankIfsc", "IFSC"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="text-muted-foreground">{label}</span>
              <input
                className="mt-1 w-full rounded-lg border bg-white/50 px-3 py-2"
                value={agency[key]}
                onChange={(e) => setAgency((a) => ({ ...a, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <label className="mt-3 block text-sm">
          <span className="text-muted-foreground">Default proposal terms</span>
          <textarea
            className="mt-1 w-full rounded-lg border bg-white/50 px-3 py-2 font-mono text-xs"
            rows={6}
            value={agency.defaultTermsAndConditions}
            onChange={(e) => setAgency((a) => ({ ...a, defaultTermsAndConditions: e.target.value }))}
          />
        </label>
        <Button className="mt-4" onClick={() => saveAgencyMutation.mutate()} disabled={saveAgencyMutation.isPending}>
          {saveAgencyMutation.isPending ? "Saving…" : "Save agency profile"}
        </Button>
      </div>

      <div className="glass-panel p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Server className="h-5 w-5" />
          Workflow automation
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Engine: <strong>{automationStatus?.engine ?? "—"}</strong>
          {automationStatus?.redisConfigured
            ? " (REDIS_URL set — BullMQ when Redis is reachable)"
            : " (no REDIS_URL — in-process cron on API server)"}
        </p>

        <div className="mt-4 space-y-2">
          {(
            [
              ["enabled", "Master switch"],
              ["leadSlaScan", "Lead SLA breach detection"],
              ["proposalFollowUp", "Proposal follow-up reminders"],
              ["invoiceOverdue", "Invoice overdue marking"],
              ["deliverableReviewNudge", "Stale deliverable review nudges"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={workflowForm[key]}
                onChange={(e) => setWorkflowForm((w) => ({ ...w, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
        <Button className="mt-4" onClick={() => saveWorkflowMutation.mutate()} disabled={saveWorkflowMutation.isPending}>
          {saveWorkflowMutation.isPending ? "Saving…" : "Save workflow toggles"}
        </Button>

        <div className="mt-6 border-t pt-4">
          <p className="text-sm font-medium">Manual trigger (testing)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(JOB_LABELS).map(([key, label]) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => triggerMutation.mutate(key)}
                disabled={triggerMutation.isPending}
              >
                <Play className="h-3 w-3" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        {automationRuns.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
            {automationRuns.slice(0, 5).map((run) => (
              <li key={run.id}>
                {run.summary} — {new Date(run.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
