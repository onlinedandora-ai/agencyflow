import {
  InvoiceStatus,
  LeadStage,
  type Prisma,
  ProposalStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getWorkflowSettings } from "@/lib/server/settings";
import {
  AUTOMATION_JOB_TYPES,
  type AutomationJobType,
} from "@/lib/server/workflow-defaults";
import { jsonError } from "@/lib/server/http";

const SLA_MINUTES = 30;
const PROPOSAL_FOLLOWUP_HOURS = 24;
const DELIVERABLE_NUDGE_HOURS = 4;

async function logRun(
  jobType: AutomationJobType,
  status: "success" | "skipped" | "error",
  summary: string,
  details?: Prisma.InputJsonValue,
) {
  await prisma.automationRun.create({
    data: { jobType, status, summary, details },
  });
}

export async function scanLeadSla() {
  const settings = await getWorkflowSettings();
  if (!settings.enabled || !settings.leadSlaScan) {
    await logRun("lead_sla_scan", "skipped", "Lead SLA scan disabled");
    return { skipped: true };
  }

  const cutoff = new Date(Date.now() - SLA_MINUTES * 60 * 1000);
  const leads = await prisma.lead.findMany({
    where: {
      firstResponseAt: null,
      slaBreached: false,
      archivedAt: null,
      stage: LeadStage.NEW,
      createdAt: { lt: cutoff },
    },
    include: { assignee: { select: { name: true, email: true } } },
  });

  if (!leads.length) {
    await logRun("lead_sla_scan", "success", "No new SLA breaches");
    return { breached: 0 };
  }

  await prisma.lead.updateMany({
    where: { id: { in: leads.map((l) => l.id) } },
    data: { slaBreached: true },
  });

  for (const lead of leads) {
    await prisma.auditLog.create({
      data: {
        entityType: "Lead",
        entityId: lead.id,
        action: "sla_breach",
        metadata: {
          leadName: lead.name,
          assignee: lead.assignee?.name ?? null,
          elapsedMinutes: Math.round(
            (Date.now() - lead.createdAt.getTime()) / 60000,
          ),
        },
      },
    });
  }

  const summary = `Marked ${leads.length} lead(s) as SLA breached`;
  await logRun("lead_sla_scan", "success", summary, {
    leadIds: leads.map((l) => l.id),
    count: leads.length,
  });
  console.warn(`[automations] ${summary}`);
  return { breached: leads.length, leadIds: leads.map((l) => l.id) };
}

export async function scanProposalFollowUps() {
  const settings = await getWorkflowSettings();
  if (!settings.enabled || !settings.proposalFollowUp) {
    await logRun("proposal_followup", "skipped", "Proposal follow-up scan disabled");
    return { skipped: true };
  }

  const cutoff = new Date(Date.now() - PROPOSAL_FOLLOWUP_HOURS * 60 * 60 * 1000);
  const proposals = await prisma.proposal.findMany({
    where: {
      status: ProposalStatus.SENT,
      sentAt: { lt: cutoff },
    },
    include: { lead: { select: { id: true, name: true, email: true } } },
  });

  if (!proposals.length) {
    await logRun("proposal_followup", "success", "No overdue proposal follow-ups");
    return { overdue: 0 };
  }

  for (const proposal of proposals) {
    await prisma.auditLog.create({
      data: {
        entityType: "Proposal",
        entityId: proposal.id,
        action: "followup_overdue",
        metadata: {
          leadName: proposal.lead.name,
          proposalNumber: proposal.proposalNumber,
          sentAt: proposal.sentAt?.toISOString(),
        },
      },
    });
  }

  const summary = `${proposals.length} proposal(s) need follow-up (>24h since sent)`;
  await logRun("proposal_followup", "success", summary, {
    proposalIds: proposals.map((p) => p.id),
    count: proposals.length,
  });
  console.warn(`[automations] ${summary}`);
  return { overdue: proposals.length };
}

export async function scanOverdueInvoices() {
  const settings = await getWorkflowSettings();
  if (!settings.enabled || !settings.invoiceOverdue) {
    await logRun("invoice_overdue", "skipped", "Invoice overdue scan disabled");
    return { skipped: true };
  }

  const now = new Date();
  const overdue = await prisma.invoice.findMany({
    where: {
      dueDate: { lt: now },
      status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
      documentType: { in: ["TAX", "DRAFT"] },
    },
    include: { workspace: { select: { name: true, company: true } } },
  });

  if (!overdue.length) {
    await logRun("invoice_overdue", "success", "No newly overdue invoices");
    return { marked: 0 };
  }

  await prisma.invoice.updateMany({
    where: { id: { in: overdue.map((i) => i.id) } },
    data: { status: InvoiceStatus.OVERDUE },
  });

  for (const invoice of overdue) {
    await prisma.auditLog.create({
      data: {
        entityType: "Invoice",
        entityId: invoice.id,
        action: "payment_overdue",
        metadata: {
          number: invoice.number,
          client: invoice.workspace.company || invoice.workspace.name,
          dueDate: invoice.dueDate?.toISOString(),
          amount: invoice.amount.toString(),
        },
      },
    });
  }

  const summary = `Marked ${overdue.length} invoice(s) as overdue`;
  await logRun("invoice_overdue", "success", summary, {
    invoiceIds: overdue.map((i) => i.id),
    count: overdue.length,
  });
  console.warn(`[automations] ${summary}`);
  return { marked: overdue.length };
}

export async function scanPendingDeliverableReviews() {
  const settings = await getWorkflowSettings();
  if (!settings.enabled || !settings.deliverableReviewNudge) {
    await logRun("deliverable_review_nudge", "skipped", "Deliverable review nudge disabled");
    return { skipped: true };
  }

  const cutoff = new Date(Date.now() - DELIVERABLE_NUDGE_HOURS * 60 * 60 * 1000);
  const pending = await prisma.taskDeliverable.findMany({
    where: {
      status: "PENDING_REVIEW",
      submittedAt: { lt: cutoff },
    },
    include: {
      task: {
        select: {
          title: true,
          project: {
            select: {
              name: true,
              workspace: { select: { company: true } },
            },
          },
        },
      },
      submittedBy: { select: { name: true } },
    },
  });

  if (!pending.length) {
    await logRun("deliverable_review_nudge", "success", "No stale deliverable reviews");
    return { nudged: 0 };
  }

  const summary = `${pending.length} deliverable(s) pending manager review >4h`;
  await logRun("deliverable_review_nudge", "success", summary, {
    deliverableIds: pending.map((d) => d.id),
    count: pending.length,
  });
  console.warn(`[automations] ${summary}`);
  return { nudged: pending.length };
}

export async function runAutomationJob(type: AutomationJobType) {
  switch (type) {
    case "lead_sla_scan":
      return scanLeadSla();
    case "proposal_followup":
      return scanProposalFollowUps();
    case "invoice_overdue":
      return scanOverdueInvoices();
    case "deliverable_review_nudge":
      return scanPendingDeliverableReviews();
    default:
      throw new Error(`Unknown automation job: ${type}`);
  }
}

export function isAutomationJobType(value: string): value is AutomationJobType {
  return AUTOMATION_JOB_TYPES.includes(value as AutomationJobType);
}

export async function triggerAutomationJob(type: AutomationJobType) {
  const result = await runAutomationJob(type);
  return { mode: "cron" as const, type, result };
}

export async function runAllAutomationJobs() {
  const results: Record<string, unknown> = {};
  for (const job of AUTOMATION_JOB_TYPES) {
    results[job] = await runAutomationJob(job);
  }
  return results;
}

export async function getRecentAutomationRuns(limit = 20) {
  return prisma.automationRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function getAutomationStatus() {
  return {
    engine: "cron",
    redisConfigured: false,
  };
}

/** Cron route auth — Bearer CRON_SECRET, CRON_SECRET header, or Vercel cron marker. */
export function verifyCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();

  if (secret) {
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    const cronHeader =
      request.headers.get("CRON_SECRET")?.trim() ||
      request.headers.get("cron-secret")?.trim();

    if (bearer === secret || cronHeader === secret) {
      return null;
    }
  }

  if (request.headers.get("x-vercel-cron")) {
    return null;
  }

  if (!secret && process.env.NODE_ENV !== "production") {
    return null;
  }

  return jsonError("Unauthorized", 401);
}
