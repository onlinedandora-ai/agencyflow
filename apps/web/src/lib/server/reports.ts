import {
  InvoiceDocumentType,
  InvoiceStatus,
  ProjectStatus,
} from "@prisma/client";
import { getPipelineStats } from "@/lib/server/leads";
import { prisma } from "@/lib/server/prisma";

async function getInvoiceStats() {
  const invoices = await prisma.invoice.findMany({
    where: {
      documentType: {
        in: [InvoiceDocumentType.TAX, InvoiceDocumentType.DRAFT],
      },
      status: { not: InvoiceStatus.CANCELLED },
    },
    select: { amount: true, status: true, paidAt: true },
  });

  const toNum = (d: { toString(): string }) => Number(d.toString());
  const collected = invoices
    .filter((i) => i.status === InvoiceStatus.PAID)
    .reduce((sum, i) => sum + toNum(i.amount), 0);
  const outstandingStatuses: InvoiceStatus[] = [
    InvoiceStatus.SENT,
    InvoiceStatus.PARTIALLY_PAID,
    InvoiceStatus.OVERDUE,
    InvoiceStatus.REQUESTED,
  ];
  const outstanding = invoices
    .filter((i) => outstandingStatuses.includes(i.status))
    .reduce((sum, i) => sum + toNum(i.amount), 0);
  const overdue = invoices
    .filter((i) => i.status === InvoiceStatus.OVERDUE)
    .reduce((sum, i) => sum + toNum(i.amount), 0);

  return {
    totalInvoices: invoices.length,
    collected,
    outstanding,
    overdueAmount: overdue,
    overdueCount: invoices.filter((i) => i.status === InvoiceStatus.OVERDUE)
      .length,
    paidCount: invoices.filter((i) => i.status === InvoiceStatus.PAID).length,
  };
}

async function getProjectHealth() {
  const projects = await prisma.project.findMany({
    where: {
      status: { in: [ProjectStatus.ACTIVE, ProjectStatus.AWAITING_ADVANCE] },
    },
    include: {
      workspace: { select: { name: true, company: true } },
      tasks: { select: { status: true, dueDate: true, priority: true } },
    },
  });

  const now = Date.now();
  return projects.map((p) => {
    const tasks = p.tasks;
    const overdueCount = tasks.filter(
      (t) =>
        t.dueDate && t.dueDate.getTime() < now && t.status !== "APPROVED",
    ).length;
    const completedCount = tasks.filter((t) => t.status === "APPROVED")
      .length;
    const progressPercent = tasks.length
      ? Math.round((completedCount / tasks.length) * 100)
      : 0;
    const health =
      overdueCount > 0 ? "red" : progressPercent < 40 ? "yellow" : "green";

    return {
      id: p.id,
      name: p.name,
      status: p.status,
      client: p.workspace.company || p.workspace.name,
      taskCount: tasks.length,
      overdueCount,
      completedCount,
      progressPercent,
      health,
    };
  });
}

async function getDeliverableStats() {
  const [pending, shared, approved] = await Promise.all([
    prisma.taskDeliverable.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.taskDeliverable.count({ where: { status: "SHARED" } }),
    prisma.taskDeliverable.count({ where: { status: "CLIENT_APPROVED" } }),
  ]);
  return {
    pendingReview: pending,
    awaitingClient: shared,
    clientApproved: approved,
  };
}

async function getRecentAutomationRuns(limit = 20) {
  return prisma.automationRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getReportsOverview() {
  const [pipeline, invoices, projects, deliverables, automationRuns] =
    await Promise.all([
      getPipelineStats(),
      getInvoiceStats(),
      getProjectHealth(),
      getDeliverableStats(),
      getRecentAutomationRuns(10),
    ]);

  const overdueProposals = await prisma.proposal.count({
    where: {
      status: "SENT",
      sentAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  return {
    pipeline,
    revenue: invoices,
    projects,
    deliverables,
    overdueProposals,
    automation: {
      recentRuns: automationRuns,
    },
  };
}
