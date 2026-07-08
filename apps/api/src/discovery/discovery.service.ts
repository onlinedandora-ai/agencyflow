import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertDiscoveryDto } from './dto/discovery.dto';

@Injectable()
export class DiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async findByLead(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    let discovery = await this.prisma.discoveryCall.findUnique({
      where: { leadId },
      include: { lead: true },
    });

    if (!discovery) {
      discovery = await this.prisma.discoveryCall.create({
        data: { leadId },
        include: { lead: true },
      });
    }

    return discovery;
  }

  async upsert(leadId: string, dto: UpsertDiscoveryDto) {
    await this.findByLead(leadId);

    const discovery = await this.prisma.discoveryCall.upsert({
      where: { leadId },
      create: {
        leadId,
        researchNotes: dto.researchNotes,
        callNotes: dto.callNotes,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        answers: dto.answers,
        completedAt: dto.answers ? new Date() : undefined,
      },
      update: {
        researchNotes: dto.researchNotes,
        callNotes: dto.callNotes,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        answers: dto.answers,
        completedAt: dto.answers ? new Date() : undefined,
      },
      include: { lead: true },
    });

    if (dto.answers) {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: {
          stage: LeadStage.DISCOVERY_SCHEDULED,
          stageChangedAt: new Date(),
        },
      });
    }

    return discovery;
  }
}
