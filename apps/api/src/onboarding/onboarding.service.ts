import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStage, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PaymentMode } from '@prisma/client';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  async listWorkspaces() {
    return this.prisma.clientWorkspace.findMany({
      include: {
        projects: { include: { invoices: true } },
        invoices: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWorkspace(id: string) {
    const workspace = await this.prisma.clientWorkspace.findUnique({
      where: { id },
      include: {
        projects: { include: { tasks: true, invoices: true } },
        invoices: { orderBy: { createdAt: 'desc' }, include: { receipts: true } },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async convertLead(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { proposal: { include: { caseStudy: true } } },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    if (lead.stage !== LeadStage.CLOSED_WON && lead.stage !== LeadStage.NEGOTIATION) {
      throw new BadRequestException('Lead must be in Negotiation or Closed Won to convert');
    }

    const existing = await this.prisma.clientWorkspace.findFirst({ where: { leadId } });
    if (existing) return this.getWorkspace(existing.id);

    const serviceLine = lead.proposal?.caseStudy?.serviceLine || 'Content Creation';
    const billingFlow = lead.proposal?.billingFlow || 'DIRECT';

    const workspace = await this.prisma.clientWorkspace.create({
      data: {
        leadId,
        name: lead.name,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        serviceLine,
        billingFlow,
      },
    });

    await this.prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: `${lead.company || lead.name} — Delivery`,
        status: ProjectStatus.AWAITING_ADVANCE,
      },
    });

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { stage: LeadStage.CLOSED_WON, stageChangedAt: new Date() },
    });

    return this.getWorkspace(workspace.id);
  }

  async confirmAdvancePayment(invoiceId: string) {
    return this.invoicesService.recordPayment(invoiceId, {
      paymentMode: PaymentMode.OFFLINE,
      paymentReference: 'Manual confirmation',
    });
  }
}
