import { LeadSource, LeadStage } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";

export const SLA_MINUTES = 30;

const ACTIVE_LEAD_FILTER = { archivedAt: null };

const ASSIGNEE_INCLUDE = {
  assignee: { select: { id: true, name: true, email: true } },
} as const;

const LEAD_DETAIL_INCLUDE = {
  ...ASSIGNEE_INCLUDE,
  discovery: true,
  proposal: true,
} as const;

export class LeadHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.enum(LeadSource).optional(),
  notes: z.string().optional(),
  assigneeId: z.string().optional(),
});

export const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.enum(LeadSource).optional(),
  stage: z.enum(LeadStage).optional(),
  notes: z.string().optional(),
  assigneeId: z.string().optional(),
});

export const logFirstResponseSchema = z.object({
  notes: z.string().optional(),
});

type LeadWithSlaInput = {
  createdAt: Date;
  firstResponseAt: Date | null;
  slaBreached: boolean;
};

export function withSlaMeta<T extends LeadWithSlaInput>(lead: T) {
  const now = Date.now();
  const created = lead.createdAt.getTime();
  const elapsedMinutes = (now - created) / 60000;
  const remainingMinutes = Math.max(0, SLA_MINUTES - elapsedMinutes);
  const breached =
    lead.slaBreached || (!lead.firstResponseAt && elapsedMinutes > SLA_MINUTES);

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

function dedupeById<T extends { id: string }>(leads: T[]) {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    if (seen.has(lead.id)) return false;
    seen.add(lead.id);
    return true;
  });
}

async function getLeadOrThrow(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: LEAD_DETAIL_INCLUDE,
  });

  if (!lead) {
    throw new LeadHttpError("Lead not found", 404);
  }

  return lead;
}

export async function findAllLeads() {
  const leads = await prisma.lead.findMany({
    where: ACTIVE_LEAD_FILTER,
    include: ASSIGNEE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return dedupeById(leads).map((lead) => withSlaMeta(lead));
}

export async function findArchivedLeads() {
  const leads = await prisma.lead.findMany({
    where: { archivedAt: { not: null } },
    include: ASSIGNEE_INCLUDE,
    orderBy: { archivedAt: "desc" },
  });

  return leads.map((lead) => withSlaMeta(lead));
}

export async function findLeadsByStage() {
  const leads = await findAllLeads();
  const stages = Object.values(LeadStage);

  return stages.map((stage) => ({
    stage,
    leads: leads.filter((lead) => lead.stage === stage),
  }));
}

export async function findLeadById(id: string) {
  const lead = await getLeadOrThrow(id);
  return withSlaMeta(lead);
}

export async function createLead(input: z.infer<typeof createLeadSchema>) {
  const email = input.email?.trim().toLowerCase();
  if (email) {
    const existing = await prisma.lead.findFirst({
      where: { email, archivedAt: null },
    });
    if (existing) {
      throw new LeadHttpError(
        "A lead with this email already exists in the pipeline. Edit the existing lead or archive it first.",
        400,
      );
    }
  }

  const lead = await prisma.lead.create({
    data: { ...input, ...(email ? { email } : {}) },
    include: ASSIGNEE_INCLUDE,
  });

  return withSlaMeta(lead);
}

export async function updateLead(
  id: string,
  input: z.infer<typeof updateLeadSchema>,
) {
  const existing = await getLeadOrThrow(id);
  if (existing.archivedAt) {
    throw new LeadHttpError(
      "Archived leads cannot be edited. Restore from archive first.",
      400,
    );
  }

  const email = input.email?.trim().toLowerCase();
  if (email && email !== existing.email?.toLowerCase()) {
    const duplicate = await prisma.lead.findFirst({
      where: { email, archivedAt: null, id: { not: id } },
    });
    if (duplicate) {
      throw new LeadHttpError("Another active lead already uses this email.", 400);
    }
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...input,
      ...(email ? { email } : {}),
      ...(input.stage ? { stageChangedAt: new Date() } : {}),
    },
    include: ASSIGNEE_INCLUDE,
  });

  return withSlaMeta(lead);
}

export async function archiveLead(id: string) {
  const lead = await getLeadOrThrow(id);
  if (lead.archivedAt) {
    throw new LeadHttpError("Lead is already archived", 400);
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: { archivedAt: new Date() },
    include: ASSIGNEE_INCLUDE,
  });

  return withSlaMeta(updated);
}

export async function restoreLead(id: string) {
  const lead = await getLeadOrThrow(id);
  if (!lead.archivedAt) {
    throw new LeadHttpError("Lead is not archived", 400);
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: { archivedAt: null },
    include: ASSIGNEE_INCLUDE,
  });

  return withSlaMeta(updated);
}

export async function deleteLead(id: string) {
  const lead = await getLeadOrThrow(id);
  if (!lead.archivedAt) {
    throw new LeadHttpError(
      "Only archived leads can be permanently deleted.",
      400,
    );
  }

  await prisma.lead.delete({ where: { id } });
  return { message: "Lead deleted permanently" };
}

export async function logFirstResponse(
  id: string,
  input: z.infer<typeof logFirstResponseSchema>,
) {
  const existing = await getLeadOrThrow(id);

  if (existing.archivedAt) {
    throw new LeadHttpError("Archived leads cannot be updated", 400);
  }

  if (existing.firstResponseAt) {
    throw new LeadHttpError("First response already logged", 400);
  }

  const now = new Date();
  const elapsedMinutes =
    (now.getTime() - existing.createdAt.getTime()) / 60000;
  const slaBreached = elapsedMinutes > SLA_MINUTES;

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      firstResponseAt: now,
      slaBreached,
      stage:
        existing.stage === LeadStage.NEW ? LeadStage.CONTACTED : existing.stage,
      stageChangedAt:
        existing.stage === LeadStage.NEW ? now : existing.stageChangedAt,
      notes: input.notes
        ? [existing.notes, input.notes].filter(Boolean).join("\n")
        : existing.notes,
    },
    include: ASSIGNEE_INCLUDE,
  });

  return withSlaMeta(lead);
}

export async function getPipelineStats() {
  const leads = await prisma.lead.findMany({ where: ACTIVE_LEAD_FILTER });
  const total = leads.length;
  const won = leads.filter((l) => l.stage === LeadStage.CLOSED_WON).length;
  const breached = leads.filter((l) => l.slaBreached).length;
  const awaitingResponse = leads.filter(
    (l) => !l.firstResponseAt && l.stage === LeadStage.NEW,
  ).length;

  return {
    total,
    won,
    conversionRate: total ? Math.round((won / total) * 100) : 0,
    slaBreaches: breached,
    awaitingFirstResponse: awaitingResponse,
  };
}

export function handleLeadError(error: unknown) {
  if (error instanceof LeadHttpError) {
    return { message: error.message, status: error.status };
  }
  throw error;
}
