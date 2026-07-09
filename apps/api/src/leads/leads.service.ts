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

  private activeLeadFilter = { archivedAt: null };

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

  private dedupeById<T extends { id: string }>(leads: T[]) {
    const seen = new Set<string>();
    return leads.filter((lead) => {
      if (seen.has(lead.id)) return false;
      seen.add(lead.id);
      return true;
    });
  }

  async findAll() {
    const leads = await this.prisma.lead.findMany({
      where: this.activeLeadFilter,
      include: { assignee: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return this.dedupeById(leads).map((lead) => this.withSlaMeta(lead));
  }

  async findArchived() {
    const leads = await this.prisma.lead.findMany({
      where: { archivedAt: { not: null } },
      include: { assignee: { select: { id: true, name: true, email: true } } },
      orderBy: { archivedAt: 'desc' },
    });

    return leads.map((lead) => this.withSlaMeta(lead));
  }

  async findByStage() {
    const leads = await this.prisma.lead.findMany({
      where: this.activeLeadFilter,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        source: true,
        stage: true,
        notes: true,
        firstResponseAt: true,
        slaBreached: true,
        archivedAt: true,
        createdAt: true,
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const withSla = this.dedupeById(leads).map((lead) => this.withSlaMeta(lead));
    const stages = Object.values(LeadStage);

    return stages.map((stage) => ({
      stage,
      leads: withSla.filter((lead) => lead.stage === stage),
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
    const email = dto.email?.trim().toLowerCase();
    if (email) {
      const existing = await this.prisma.lead.findFirst({
        where: { email, archivedAt: null },
      });
      if (existing) {
        throw new BadRequestException(
          'A lead with this email already exists in the pipeline. Edit the existing lead or archive it first.',
        );
      }
    }

    const lead = await this.prisma.lead.create({
      data: { ...dto, ...(email ? { email } : {}) },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });

    return this.withSlaMeta(lead);
  }

  async update(id: string, dto: UpdateLeadDto) {
    const existing = await this.findOne(id);
    if (existing.archivedAt) {
      throw new BadRequestException('Archived leads cannot be edited. Restore from archive first.');
    }

    const email = dto.email?.trim().toLowerCase();
    if (email && email !== existing.email?.toLowerCase()) {
      const duplicate = await this.prisma.lead.findFirst({
        where: { email, archivedAt: null, id: { not: id } },
      });
      if (duplicate) {
        throw new BadRequestException('Another active lead already uses this email.');
      }
    }

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        ...dto,
        ...(email ? { email } : {}),
        ...(dto.stage ? { stageChangedAt: new Date() } : {}),
      },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });

    return this.withSlaMeta(lead);
  }

  async archive(id: string) {
    const lead = await this.findOne(id);
    if (lead.archivedAt) {
      throw new BadRequestException('Lead is already archived');
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });

    return this.withSlaMeta(updated);
  }

  async restore(id: string) {
    const lead = await this.findOne(id);
    if (!lead.archivedAt) {
      throw new BadRequestException('Lead is not archived');
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: { archivedAt: null },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });

    return this.withSlaMeta(updated);
  }

  async remove(id: string) {
    const lead = await this.findOne(id);
    if (!lead.archivedAt) {
      throw new BadRequestException('Only archived leads can be permanently deleted.');
    }

    await this.prisma.lead.delete({ where: { id } });
    return { message: 'Lead deleted permanently' };
  }

  async logFirstResponse(id: string, dto: LogFirstResponseDto) {
    const existing = await this.findOne(id);

    if (existing.archivedAt) {
      throw new BadRequestException('Archived leads cannot be updated');
    }

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
    const [total, won, breached, awaitingResponse] = await Promise.all([
      this.prisma.lead.count({ where: this.activeLeadFilter }),
      this.prisma.lead.count({
        where: { ...this.activeLeadFilter, stage: LeadStage.CLOSED_WON },
      }),
      this.prisma.lead.count({
        where: { ...this.activeLeadFilter, slaBreached: true },
      }),
      this.prisma.lead.count({
        where: {
          ...this.activeLeadFilter,
          firstResponseAt: null,
          stage: LeadStage.NEW,
        },
      }),
    ]);

    return {
      total,
      won,
      conversionRate: total ? Math.round((won / total) * 100) : 0,
      slaBreaches: breached,
      awaitingFirstResponse: awaitingResponse,
    };
  }
}
