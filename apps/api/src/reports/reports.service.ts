import { Injectable } from '@nestjs/common';
import { InvoiceDocumentType, InvoiceStatus, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';
import { AutomationService } from '../workflows/automation.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService,
    private readonly automationService: AutomationService,
  ) {}

  async getOverview() {
    const [pipeline, invoices, projects, deliverables, automationRuns] = await Promise.all([
      this.leadsService.getPipelineStats(),
      this.getInvoiceStats(),
      this.getProjectHealth(),
      this.getDeliverableStats(),
      this.automationService.getRecentRuns(10),
    ]);

    const overdueProposals = await this.prisma.proposal.count({
      where: {
        status: 'SENT',
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

  private async getInvoiceStats() {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        documentType: { in: [InvoiceDocumentType.TAX, InvoiceDocumentType.DRAFT] },
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
      overdueCount: invoices.filter((i) => i.status === InvoiceStatus.OVERDUE).length,
      paidCount: invoices.filter((i) => i.status === InvoiceStatus.PAID).length,
    };
  }

  private async getProjectHealth() {
    const projects = await this.prisma.project.findMany({
      where: { status: { in: [ProjectStatus.ACTIVE, ProjectStatus.AWAITING_ADVANCE] } },
      include: {
        workspace: { select: { name: true, company: true } },
        tasks: { select: { status: true, dueDate: true, priority: true } },
      },
    });

    const now = Date.now();
    return projects.map((p) => {
      const tasks = p.tasks;
      const overdueCount = tasks.filter(
        (t) => t.dueDate && t.dueDate.getTime() < now && t.status !== 'APPROVED',
      ).length;
      const completedCount = tasks.filter((t) => t.status === 'APPROVED').length;
      const progressPercent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
      const health =
        overdueCount > 0 ? 'red' : progressPercent < 40 ? 'yellow' : 'green';

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

  private async getDeliverableStats() {
    const [pending, shared, approved] = await Promise.all([
      this.prisma.taskDeliverable.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.taskDeliverable.count({ where: { status: 'SHARED' } }),
      this.prisma.taskDeliverable.count({ where: { status: 'CLIENT_APPROVED' } }),
    ]);
    return { pendingReview: pending, awaitingClient: shared, clientApproved: approved };
  }
}
