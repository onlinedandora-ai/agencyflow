import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStage, ProjectStatus } from '@prisma/client';
import { DEFAULT_SERVICE_LINE } from '../common/service-line-templates';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PaymentMode } from '@prisma/client';
import { CreateWorkspaceProjectDto } from './dto/onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  async listWorkspaces(slim = false) {
    if (slim) {
      return this.prisma.clientWorkspace.findMany({
        select: { id: true, leadId: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.clientWorkspace.findMany({
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        serviceLine: true,
        billingToken: true,
        leadId: true,
        onboardingIntakeAt: true,
        brandIntakeAt: true,
        accessIntakeAt: true,
        projects: {
          select: { id: true, name: true, status: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
        invoices: {
          where: { isAdvance: true },
          select: {
            id: true,
            number: true,
            amount: true,
            status: true,
            isAdvance: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
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

  async searchWorkspaces(q?: string) {
    const term = q?.trim() ?? '';
    const where = term
      ? {
          OR: [
            { name: { contains: term, mode: 'insensitive' as const } },
            { company: { contains: term, mode: 'insensitive' as const } },
            { email: { contains: term, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    return this.prisma.clientWorkspace.findMany({
      where,
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        serviceLine: true,
      },
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  async createProjectForWorkspace(workspaceId: string, dto: CreateWorkspaceProjectDto) {
    const workspace = await this.prisma.clientWorkspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const serviceLine = dto.serviceLine || workspace.serviceLine || DEFAULT_SERVICE_LINE;

    await this.prisma.$transaction([
      this.prisma.project.create({
        data: {
          workspaceId,
          name: dto.name.trim(),
          status: ProjectStatus.AWAITING_ADVANCE,
        },
      }),
      ...(dto.serviceLine && dto.serviceLine !== workspace.serviceLine
        ? [
            this.prisma.clientWorkspace.update({
              where: { id: workspaceId },
              data: { serviceLine: dto.serviceLine },
            }),
          ]
        : []),
    ]);

    return this.getWorkspace(workspaceId);
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
    if (existing) {
      return { workspace: await this.getWorkspace(existing.id), alreadyConverted: true };
    }

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

    return { workspace: await this.getWorkspace(workspace.id), alreadyConverted: false };
  }

  async confirmAdvancePayment(invoiceId: string) {
    return this.invoicesService.recordPayment(invoiceId, {
      paymentMode: PaymentMode.OFFLINE,
      paymentReference: 'Manual confirmation',
    });
  }
}
