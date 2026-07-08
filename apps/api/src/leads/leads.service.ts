import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto, LogFirstResponseDto, UpdateLeadDto } from './dto/lead.dto';

const SLA_MINUTES = 30;

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  private withSlaMeta<T extends { createdAt: Date; firstResponseAt: Date | null; slaBreached: boolean }>(lead: T) {
    const now = Date.now();
    const created = lead.createdAt.getTime();
    const elapsedMinutes = (now - created) / 60000;
    const remainingMinutes = Math.max(0, SLA_MINUTES - elapsedMinutes);
    const breached = lead.slaBreached || (!lead.firstResponseAt && elapsedMinutes > SLA_MINUTES);

    return {
      ...lead,
      sla: {
        targetMinutes: SLA_MINUTES,
        elapsedMinutes: Math.round(elapsedMinutes),
        remainingMinutes: Math.round(remainingMinutes),
        breached,
        responded: Boolean(lead.firstResponseAt),
      },
    };
  }

  async findAll() {
    const leads = await this.prisma.lead.findMany({
      include: { assignee: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return leads.map((lead) => this.withSlaMeta(lead));
  }

  async findByStage() {
    const leads = await this.findAll();
    const stages = Object.values(LeadStage);

    return stages.map((stage) => ({
      stage,
      leads: leads.filter((lead) => lead.stage === stage),
    }));
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        discovery: true,
        proposal: true,
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return this.withSlaMeta(lead);
  }

  async create(dto: CreateLeadDto) {
    const lead = await this.prisma.lead.create({
      data: dto,
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });

    return this.withSlaMeta(lead);
  }

  async update(id: string, dto: UpdateLeadDto) {
    await this.findOne(id);

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.stage ? { stageChangedAt: new Date() } : {}),
      },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });

    return this.withSlaMeta(lead);
  }

  async logFirstResponse(id: string, dto: LogFirstResponseDto) {
    const existing = await this.findOne(id);

    if (existing.firstResponseAt) {
      throw new BadRequestException('First response already logged');
    }

    const now = new Date();
    const elapsedMinutes = (now.getTime() - existing.createdAt.getTime()) / 60000;
    const slaBreached = elapsedMinutes > SLA_MINUTES;

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        firstResponseAt: now,
        slaBreached,
        stage: existing.stage === LeadStage.NEW ? LeadStage.CONTACTED : existing.stage,
        stageChangedAt: existing.stage === LeadStage.NEW ? now : existing.stageChangedAt,
        notes: dto.notes
          ? [existing.notes, dto.notes].filter(Boolean).join('\n')
          : existing.notes,
      },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });

    return this.withSlaMeta(lead);
  }

  async getPipelineStats() {
    const leads = await this.prisma.lead.findMany();
    const total = leads.length;
    const won = leads.filter((l) => l.stage === LeadStage.CLOSED_WON).length;
    const breached = leads.filter((l) => l.slaBreached).length;
    const awaitingResponse = leads.filter((l) => !l.firstResponseAt && l.stage === LeadStage.NEW).length;

    return {
      total,
      won,
      conversionRate: total ? Math.round((won / total) * 100) : 0,
      slaBreaches: breached,
      awaitingFirstResponse: awaitingResponse,
    };
  }
}
