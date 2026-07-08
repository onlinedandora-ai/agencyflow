import { Injectable, Logger } from '@nestjs/common';
import { InvoiceStatus, LeadStage, Prisma, ProposalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  DEFAULT_WORKFLOW_SETTINGS,
  type AutomationJobType,
  type WorkflowSettings,
} from './workflow-defaults';

const SLA_MINUTES = 30;
const PROPOSAL_FOLLOWUP_HOURS = 24;
const DELIVERABLE_NUDGE_HOURS = 4;

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  private async getSettings(): Promise<WorkflowSettings> {
    const profile = await this.settingsService.getAgencyProfile();
    const raw = profile.workflowSettings as WorkflowSettings | null;
    return { ...DEFAULT_WORKFLOW_SETTINGS, ...(raw || {}) };
  }

  private async logRun(
    jobType: AutomationJobType,
    status: 'success' | 'skipped' | 'error',
    summary: string,
    details?: Prisma.InputJsonValue,
  ) {
    await this.prisma.automationRun.create({
      data: { jobType, status, summary, details },
    });
  }

  async scanLeadSla() {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.leadSlaScan) {
      await this.logRun('lead_sla_scan', 'skipped', 'Lead SLA scan disabled');
      return { skipped: true };
    }

    const cutoff = new Date(Date.now() - SLA_MINUTES * 60 * 1000);
    const leads = await this.prisma.lead.findMany({
      where: {
        firstResponseAt: null,
        slaBreached: false,
        stage: LeadStage.NEW,
        createdAt: { lt: cutoff },
      },
      include: { assignee: { select: { name: true, email: true } } },
    });

    if (!leads.length) {
      await this.logRun('lead_sla_scan', 'success', 'No new SLA breaches');
      return { breached: 0 };
    }

    await this.prisma.lead.updateMany({
      where: { id: { in: leads.map((l) => l.id) } },
      data: { slaBreached: true },
    });

    for (const lead of leads) {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'Lead',
          entityId: lead.id,
          action: 'sla_breach',
          metadata: {
            leadName: lead.name,
            assignee: lead.assignee?.name ?? null,
            elapsedMinutes: Math.round((Date.now() - lead.createdAt.getTime()) / 60000),
          },
        },
      });
    }

    const summary = `Marked ${leads.length} lead(s) as SLA breached`;
    await this.logRun('lead_sla_scan', 'success', summary, {
      leadIds: leads.map((l) => l.id),
      count: leads.length,
    });
    this.logger.warn(summary);
    return { breached: leads.length, leadIds: leads.map((l) => l.id) };
  }

  async scanProposalFollowUps() {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.proposalFollowUp) {
      await this.logRun('proposal_followup', 'skipped', 'Proposal follow-up scan disabled');
      return { skipped: true };
    }

    const cutoff = new Date(Date.now() - PROPOSAL_FOLLOWUP_HOURS * 60 * 60 * 1000);
    const proposals = await this.prisma.proposal.findMany({
      where: {
        status: ProposalStatus.SENT,
        sentAt: { lt: cutoff },
      },
      include: { lead: { select: { id: true, name: true, email: true } } },
    });

    if (!proposals.length) {
      await this.logRun('proposal_followup', 'success', 'No overdue proposal follow-ups');
      return { overdue: 0 };
    }

    for (const proposal of proposals) {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'Proposal',
          entityId: proposal.id,
          action: 'followup_overdue',
          metadata: {
            leadName: proposal.lead.name,
            proposalNumber: proposal.proposalNumber,
            sentAt: proposal.sentAt?.toISOString(),
          },
        },
      });
    }

    const summary = `${proposals.length} proposal(s) need follow-up (>24h since sent)`;
    await this.logRun('proposal_followup', 'success', summary, {
      proposalIds: proposals.map((p) => p.id),
      count: proposals.length,
    });
    this.logger.warn(summary);
    return { overdue: proposals.length };
  }

  async scanOverdueInvoices() {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.invoiceOverdue) {
      await this.logRun('invoice_overdue', 'skipped', 'Invoice overdue scan disabled');
      return { skipped: true };
    }

    const now = new Date();
    const overdue = await this.prisma.invoice.findMany({
      where: {
        dueDate: { lt: now },
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
        documentType: { in: ['TAX', 'DRAFT'] },
      },
      include: { workspace: { select: { name: true, company: true } } },
    });

    if (!overdue.length) {
      await this.logRun('invoice_overdue', 'success', 'No newly overdue invoices');
      return { marked: 0 };
    }

    await this.prisma.invoice.updateMany({
      where: { id: { in: overdue.map((i) => i.id) } },
      data: { status: InvoiceStatus.OVERDUE },
    });

    for (const invoice of overdue) {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'Invoice',
          entityId: invoice.id,
          action: 'payment_overdue',
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
    await this.logRun('invoice_overdue', 'success', summary, {
      invoiceIds: overdue.map((i) => i.id),
      count: overdue.length,
    });
    this.logger.warn(summary);
    return { marked: overdue.length };
  }

  async scanPendingDeliverableReviews() {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.deliverableReviewNudge) {
      await this.logRun('deliverable_review_nudge', 'skipped', 'Deliverable review nudge disabled');
      return { skipped: true };
    }

    const cutoff = new Date(Date.now() - DELIVERABLE_NUDGE_HOURS * 60 * 60 * 1000);
    const pending = await this.prisma.taskDeliverable.findMany({
      where: {
        status: 'PENDING_REVIEW',
        submittedAt: { lt: cutoff },
      },
      include: {
        task: {
          select: {
            title: true,
            project: { select: { name: true, workspace: { select: { company: true } } } },
          },
        },
        submittedBy: { select: { name: true } },
      },
    });

    if (!pending.length) {
      await this.logRun('deliverable_review_nudge', 'success', 'No stale deliverable reviews');
      return { nudged: 0 };
    }

    const summary = `${pending.length} deliverable(s) pending manager review >4h`;
    await this.logRun('deliverable_review_nudge', 'success', summary, {
      deliverableIds: pending.map((d) => d.id),
      count: pending.length,
    });
    this.logger.warn(summary);
    return { nudged: pending.length };
  }

  async getRecentRuns(limit = 20) {
    return this.prisma.automationRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
