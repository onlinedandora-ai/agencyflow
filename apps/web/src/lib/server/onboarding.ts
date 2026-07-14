import {
  LeadStage,
  PaymentMode,
  ProjectStatus,
} from "@prisma/client";
import { z } from "zod";
import { recordPayment, InvoiceHttpError } from "@/lib/server/invoices";
import { prisma } from "@/lib/server/prisma";

const WORKSPACE_LIST_INCLUDE = {
  projects: { include: { invoices: true } },
  invoices: { orderBy: { createdAt: "desc" as const } },
} as const;

const WORKSPACE_DETAIL_INCLUDE = {
  projects: { include: { tasks: true, invoices: true } },
  invoices: {
    orderBy: { createdAt: "desc" as const },
    include: { receipts: true },
  },
} as const;

export class OnboardingHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const createWorkspaceProjectSchema = z.object({
  name: z.string().min(1),
  serviceLine: z.string().optional(),
});

export type CreateWorkspaceProjectInput = z.infer<typeof createWorkspaceProjectSchema>;

export async function listWorkspaces() {
  return prisma.clientWorkspace.findMany({
    include: WORKSPACE_LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function getWorkspace(id: string) {
  const workspace = await prisma.clientWorkspace.findUnique({
    where: { id },
    include: WORKSPACE_DETAIL_INCLUDE,
  });
  if (!workspace) throw new OnboardingHttpError("Workspace not found", 404);
  return workspace;
}

export async function searchWorkspaces(q?: string) {
  const term = q?.trim() ?? "";
  const where = term
    ? {
        OR: [
          { name: { contains: term, mode: "insensitive" as const } },
          { company: { contains: term, mode: "insensitive" as const } },
          { email: { contains: term, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  return prisma.clientWorkspace.findMany({
    where,
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      serviceLine: true,
    },
    orderBy: { name: "asc" },
    take: 20,
  });
}

export async function createProjectForWorkspace(
  workspaceId: string,
  dto: CreateWorkspaceProjectInput,
) {
  const workspace = await prisma.clientWorkspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) throw new OnboardingHttpError("Workspace not found", 404);

  await prisma.$transaction([
    prisma.project.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        status: ProjectStatus.AWAITING_ADVANCE,
      },
    }),
    ...(dto.serviceLine && dto.serviceLine !== workspace.serviceLine
      ? [
          prisma.clientWorkspace.update({
            where: { id: workspaceId },
            data: { serviceLine: dto.serviceLine },
          }),
        ]
      : []),
  ]);

  return getWorkspace(workspaceId);
}

export async function convertLead(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { proposal: { include: { caseStudy: true } } },
  });
  if (!lead) throw new OnboardingHttpError("Lead not found", 404);

  if (lead.stage !== LeadStage.CLOSED_WON && lead.stage !== LeadStage.NEGOTIATION) {
    throw new OnboardingHttpError(
      "Lead must be in Negotiation or Closed Won to convert",
      400,
    );
  }

  const existing = await prisma.clientWorkspace.findFirst({ where: { leadId } });
  if (existing) {
    return { workspace: await getWorkspace(existing.id), alreadyConverted: true };
  }

  const serviceLine = lead.proposal?.caseStudy?.serviceLine || "Content Creation";
  const billingFlow = lead.proposal?.billingFlow || "DIRECT";

  const workspace = await prisma.clientWorkspace.create({
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

  await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: `${lead.company || lead.name} — Delivery`,
      status: ProjectStatus.AWAITING_ADVANCE,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { stage: LeadStage.CLOSED_WON, stageChangedAt: new Date() },
  });

  return { workspace: await getWorkspace(workspace.id), alreadyConverted: false };
}

export async function confirmAdvancePayment(invoiceId: string) {
  return recordPayment(invoiceId, {
    paymentMode: PaymentMode.OFFLINE,
    paymentReference: "Manual confirmation",
  });
}

export function handleOnboardingError(error: unknown) {
  if (error instanceof OnboardingHttpError) {
    return { message: error.message, status: error.status };
  }
  if (error instanceof InvoiceHttpError) {
    return { message: error.message, status: error.status };
  }
  throw error;
}
