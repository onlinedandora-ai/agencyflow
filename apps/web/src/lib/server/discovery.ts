import { LeadStage } from "@prisma/client";
import { prisma } from "./prisma";

export type UpsertDiscoveryInput = {
  researchNotes?: string;
  callNotes?: string;
  scheduledAt?: string;
  answers?: Record<string, string>;
};

export class DiscoveryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryNotFoundError";
  }
}

export async function findByLead(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new DiscoveryNotFoundError("Lead not found");

  let discovery = await prisma.discoveryCall.findUnique({
    where: { leadId },
    include: { lead: true },
  });

  if (!discovery) {
    discovery = await prisma.discoveryCall.create({
      data: { leadId },
      include: { lead: true },
    });
  }

  return discovery;
}

export async function upsertDiscovery(leadId: string, dto: UpsertDiscoveryInput) {
  await findByLead(leadId);

  const discovery = await prisma.discoveryCall.upsert({
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
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        stage: LeadStage.DISCOVERY_SCHEDULED,
        stageChangedAt: new Date(),
      },
    });
  }

  return discovery;
}
