import {
  BillingFlow,
  InvoiceDocumentType,
  InvoiceStatus,
  LeadStage,
  ProjectStatus,
  ProposalStatus,
  RevisionRequestStatus,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { getAgencyProfile } from "@/lib/server/settings";
import { getWebOrigin } from "@/lib/server/web-origin";

const WORD_LIMIT = 300;

const PROPOSAL_INCLUDE = {
  caseStudy: true,
  lead: { include: { assignee: { select: { id: true, name: true, email: true } } } },
  sendLogs: {
    orderBy: { sentAt: "desc" as const },
    include: { sentBy: { select: { id: true, name: true } } },
  },
  revisionRequests: { orderBy: { requestedAt: "desc" as const } },
} as const;

const INVOICE_INCLUDE = {
  workspace: true,
  project: true,
  proposal: { include: { lead: true } },
  relatedInvoice: true,
  receipts: { orderBy: { paidAt: "asc" as const } },
  paymentMilestones: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      receipt: { select: { id: true, number: true, paidAt: true } },
      notifications: {
        orderBy: { sentAt: "desc" as const },
        include: { sentBy: { select: { id: true, name: true } } },
      },
    },
  },
} as const;

const WORKSPACE_INCLUDE = {
  projects: { include: { tasks: true, invoices: true } },
  invoices: { orderBy: { createdAt: "desc" as const }, include: { receipts: true } },
} as const;

export class ProposalHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const upsertProposalSchema = z.object({
  situation: z.string().optional(),
  recommendation: z.string().optional(),
  deliverables: z.string().optional(),
  timeline: z.string().optional(),
  investment: z.string().optional(),
  nextStep: z.string().optional(),
  caseStudyId: z.string().optional(),
  termsAndConditions: z.string().optional(),
  billingFlow: z.enum(BillingFlow).optional(),
});

export const acceptProposalSchema = z.object({
  acceptedByName: z.string().min(1),
  acceptedByEmail: z.string().min(1),
});

export const sendProposalSchema = z.object({
  internalNote: z.string().optional(),
});

export const resendProposalSchema = z.object({
  internalNote: z.string().optional(),
});

export const requestRevisionSchema = z.object({
  requestedByName: z.string().min(1),
  requestedByEmail: z.string().optional(),
  comments: z.string().min(10),
});

function countWords(...sections: (string | null | undefined)[]) {
  const text = sections.filter(Boolean).join(" ");
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function withMeta<
  T extends {
    sentAt: Date | null;
    wordCount: number;
    status: ProposalStatus;
    acceptedAt: Date | null;
    currentVersion: number;
  },
>(proposal: T) {
  const hoursRemaining = proposal.sentAt
    ? Math.max(
        0,
        Math.round(
          (proposal.sentAt.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / 3600000,
        ),
      )
    : null;

  const canEdit =
    proposal.status === ProposalStatus.DRAFT ||
    proposal.status === ProposalStatus.SENT ||
    proposal.status === ProposalStatus.REVISION_REQUESTED;

  return {
    ...proposal,
    wordLimit: WORD_LIMIT,
    overWordLimit: proposal.wordCount > WORD_LIMIT,
    followUpHoursRemaining: hoursRemaining,
    followUpOverdue: proposal.sentAt ? hoursRemaining === 0 : false,
    isAccepted: proposal.status === ProposalStatus.ACCEPTED,
    canEdit: canEdit && proposal.status !== ProposalStatus.ACCEPTED,
  };
}

function snapshotFromProposal(proposal: {
  situation: string | null;
  recommendation: string | null;
  deliverables: string | null;
  timeline: string | null;
  investment: string | null;
  nextStep: string | null;
  termsAndConditions: string | null;
  caseStudyId: string | null;
  wordCount: number;
}) {
  return {
    situation: proposal.situation,
    recommendation: proposal.recommendation,
    deliverables: proposal.deliverables,
    timeline: proposal.timeline,
    investment: proposal.investment,
    nextStep: proposal.nextStep,
    termsAndConditions: proposal.termsAndConditions,
    caseStudyId: proposal.caseStudyId,
    wordCount: proposal.wordCount,
  };
}

async function nextProposalNumber() {
  const count = await prisma.proposal.count();
  const year = new Date().getFullYear();
  return `PROP-${year}-${String(count + 1).padStart(4, "0")}`;
}

function formatInvoiceNumber(prefix: string, seq: number) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

async function nextInvoiceNumber(type: InvoiceDocumentType) {
  const profile = await getAgencyProfile();
  if (type === InvoiceDocumentType.DRAFT) {
    const number = formatInvoiceNumber(profile.draftInvoicePrefix, profile.draftInvoiceNextSeq);
    await prisma.agencyProfile.update({
      where: { id: "default" },
      data: { draftInvoiceNextSeq: profile.draftInvoiceNextSeq + 1 },
    });
    return number;
  }
  if (type === InvoiceDocumentType.RECEIPT) {
    const number = formatInvoiceNumber(profile.receiptPrefix, profile.receiptNextSeq);
    await prisma.agencyProfile.update({
      where: { id: "default" },
      data: { receiptNextSeq: profile.receiptNextSeq + 1 },
    });
    return number;
  }
  const number = formatInvoiceNumber(profile.taxInvoicePrefix, profile.taxInvoiceNextSeq);
  await prisma.agencyProfile.update({
    where: { id: "default" },
    data: { taxInvoiceNextSeq: profile.taxInvoiceNextSeq + 1 },
  });
  return number;
}

function parseAmount(investment?: string | null) {
  if (!investment) return 50000;
  return parseFloat(investment.replace(/[^\d.]/g, "")) || 50000;
}

function lineItemsFromProposal(proposal: {
  deliverables?: string | null;
  investment?: string | null;
}) {
  const amount = parseAmount(proposal.investment);
  return [
    {
      description:
        proposal.deliverables?.split("\n")[0] || "Project services as per proposal",
      amount,
    },
  ];
}

async function getWorkspace(id: string) {
  const workspace = await prisma.clientWorkspace.findUnique({
    where: { id },
    include: WORKSPACE_INCLUDE,
  });
  if (!workspace) {
    throw new ProposalHttpError("Workspace not found", 404);
  }
  return workspace;
}

async function convertLead(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { proposal: { include: { caseStudy: true } } },
  });
  if (!lead) {
    throw new ProposalHttpError("Lead not found", 404);
  }

  if (lead.stage !== LeadStage.CLOSED_WON && lead.stage !== LeadStage.NEGOTIATION) {
    throw new ProposalHttpError(
      "Lead must be in Negotiation or Closed Won to convert",
      400,
    );
  }

  const existing = await prisma.clientWorkspace.findFirst({ where: { leadId } });
  if (existing) {
    return { workspace: await getWorkspace(existing.id), alreadyConverted: true };
  }

  const serviceLine = lead.proposal?.caseStudy?.serviceLine || "Content Creation";
  const billingFlow = lead.proposal?.billingFlow || BillingFlow.DIRECT;

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

async function createInvoiceOnAccept(params: {
  workspaceId: string;
  projectId: string;
  proposalId: string;
  billingFlow: BillingFlow;
  investment?: string | null;
  deliverables?: string | null;
  isAdvance?: boolean;
}) {
  const amount = parseAmount(params.investment);
  const lineItems = lineItemsFromProposal({
    investment: params.investment,
    deliverables: params.deliverables,
  });

  await prisma.clientWorkspace.update({
    where: { id: params.workspaceId },
    data: {
      billingFlow: params.billingFlow,
      billingToken: randomBytes(18).toString("hex"),
    },
  });

  if (params.billingFlow === BillingFlow.DRAFT_FIRST) {
    const number = await nextInvoiceNumber(InvoiceDocumentType.DRAFT);
    return prisma.invoice.create({
      data: {
        workspaceId: params.workspaceId,
        projectId: params.projectId,
        proposalId: params.proposalId,
        number,
        documentType: InvoiceDocumentType.DRAFT,
        amount,
        description: "Draft invoice — for client review before tax invoice",
        lineItems,
        status: InvoiceStatus.SENT,
        sentAt: new Date(),
        publicToken: randomBytes(18).toString("hex"),
      },
      include: INVOICE_INCLUDE,
    });
  }

  const number = await nextInvoiceNumber(InvoiceDocumentType.TAX);
  return prisma.invoice.create({
    data: {
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      proposalId: params.proposalId,
      number,
      documentType: InvoiceDocumentType.TAX,
      amount,
      description: params.isAdvance
        ? "Tax invoice — payment per milestones"
        : "Tax invoice",
      lineItems,
      status: InvoiceStatus.SENT,
      sentAt: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isAdvance: params.isAdvance ?? false,
      publicToken: randomBytes(18).toString("hex"),
    },
    include: INVOICE_INCLUDE,
  });
}

function validateProposalContent(proposal: {
  situation: string | null;
  recommendation: string | null;
  deliverables: string | null;
  timeline: string | null;
  investment: string | null;
  nextStep: string | null;
  termsAndConditions: string | null;
}) {
  const required = [
    proposal.situation,
    proposal.recommendation,
    proposal.deliverables,
    proposal.timeline,
    proposal.investment,
    proposal.nextStep,
    proposal.termsAndConditions,
  ];
  if (required.some((s) => !s?.trim())) {
    throw new ProposalHttpError(
      "All six proposal sections and terms & conditions must be filled before sending",
      400,
    );
  }
}

export async function findAllProposals() {
  const proposals = await prisma.proposal.findMany({
    include: PROPOSAL_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
  const origin = getWebOrigin();
  return proposals.map((p) => ({
    ...withMeta(p),
    clientUrl: p.publicToken ? `${origin}/p/${p.publicToken}` : null,
  }));
}

export async function findProposalByLead(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    throw new ProposalHttpError("Lead not found", 404);
  }

  const agency = await getAgencyProfile();

  let proposal = await prisma.proposal.findUnique({
    where: { leadId },
    include: PROPOSAL_INCLUDE,
  });

  if (!proposal) {
    proposal = await prisma.proposal.create({
      data: { leadId, termsAndConditions: agency.defaultTermsAndConditions },
      include: PROPOSAL_INCLUDE,
    });
  }

  const meta = withMeta(proposal);
  const clientUrl = proposal.publicToken
    ? `${getWebOrigin()}/p/${proposal.publicToken}`
    : null;

  return { ...meta, clientUrl };
}

export async function findByPublicToken(token: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { publicToken: token },
    include: PROPOSAL_INCLUDE,
  });
  if (!proposal) {
    throw new ProposalHttpError("Proposal not found", 404);
  }

  const agency = await getAgencyProfile();
  return { ...withMeta(proposal), agency };
}

export async function upsertProposal(
  leadId: string,
  dto: z.infer<typeof upsertProposalSchema>,
) {
  const existing = await prisma.proposal.findUnique({ where: { leadId } });
  if (existing?.status === ProposalStatus.ACCEPTED) {
    throw new ProposalHttpError("Cannot edit an accepted proposal", 400);
  }

  await findProposalByLead(leadId);

  const wordCount = countWords(
    dto.situation,
    dto.recommendation,
    dto.deliverables,
    dto.timeline,
    dto.investment,
    dto.nextStep,
  );

  const proposal = await prisma.proposal.upsert({
    where: { leadId },
    create: { leadId, ...dto, wordCount },
    update: { ...dto, wordCount },
    include: PROPOSAL_INCLUDE,
  });

  return withMeta(proposal);
}

export async function sendProposal(
  leadId: string,
  dto: z.infer<typeof sendProposalSchema> = {},
  actorId?: string,
) {
  const proposal = await prisma.proposal.findUnique({ where: { leadId } });
  if (!proposal) {
    throw new ProposalHttpError("Proposal not found", 404);
  }
  if (proposal.status === ProposalStatus.ACCEPTED) {
    throw new ProposalHttpError("Proposal already accepted", 400);
  }
  if (proposal.currentVersion > 0) {
    throw new ProposalHttpError("Proposal already sent. Use resend after revisions.", 400);
  }

  validateProposalContent(proposal);

  const now = new Date();
  const proposalNumber = proposal.proposalNumber || (await nextProposalNumber());
  const publicToken = proposal.publicToken || randomBytes(24).toString("hex");
  const version = 1;
  const publicUrl = `${getWebOrigin()}/p/${publicToken}`;

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.proposal.update({
      where: { leadId },
      data: {
        sentAt: now,
        status: ProposalStatus.SENT,
        proposalNumber,
        publicToken,
        currentVersion: version,
      },
      include: PROPOSAL_INCLUDE,
    });

    await tx.proposalSendLog.create({
      data: {
        proposalId: p.id,
        version,
        sentAt: now,
        sentById: actorId,
        isResend: false,
        publicUrl,
        internalNote: dto.internalNote,
        snapshot: snapshotFromProposal(p),
      },
    });

    await tx.lead.update({
      where: { id: leadId },
      data: { stage: LeadStage.PROPOSAL_SENT, stageChangedAt: now },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        entityType: "Proposal",
        entityId: p.id,
        action: "PROPOSAL_SENT",
        metadata: { proposalNumber, leadId, version, publicUrl },
      },
    });

    return p;
  });

  return {
    ...withMeta(updated),
    clientUrl: publicUrl,
    version,
    message: "Proposal sent. Share the client link with your call to action.",
  };
}

export async function resendProposal(
  leadId: string,
  dto: z.infer<typeof resendProposalSchema> = {},
  actorId?: string,
) {
  const proposal = await prisma.proposal.findUnique({
    where: { leadId },
    include: { revisionRequests: true },
  });
  if (!proposal) {
    throw new ProposalHttpError("Proposal not found", 404);
  }
  if (proposal.status === ProposalStatus.ACCEPTED) {
    throw new ProposalHttpError("Cannot resend an accepted proposal", 400);
  }
  if (proposal.currentVersion === 0) {
    throw new ProposalHttpError("Proposal has not been sent yet", 400);
  }

  validateProposalContent(proposal);

  const now = new Date();
  const version = proposal.currentVersion + 1;
  const publicUrl = `${getWebOrigin()}/p/${proposal.publicToken}`;

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.proposal.update({
      where: { leadId },
      data: {
        sentAt: now,
        status: ProposalStatus.SENT,
        currentVersion: version,
      },
      include: PROPOSAL_INCLUDE,
    });

    await tx.proposalSendLog.create({
      data: {
        proposalId: p.id,
        version,
        sentAt: now,
        sentById: actorId,
        isResend: true,
        publicUrl,
        internalNote: dto.internalNote,
        snapshot: snapshotFromProposal(p),
      },
    });

    const pendingRevisions = proposal.revisionRequests.filter(
      (r) =>
        r.status === RevisionRequestStatus.PENDING ||
        r.status === RevisionRequestStatus.IN_PROGRESS,
    );

    for (const rev of pendingRevisions) {
      await tx.proposalRevisionRequest.update({
        where: { id: rev.id },
        data: {
          status: RevisionRequestStatus.ADDRESSED,
          addressedAt: now,
          addressedInVersion: version,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId,
        entityType: "Proposal",
        entityId: p.id,
        action: "PROPOSAL_RESENT",
        metadata: { leadId, version, publicUrl, revisionsAddressed: pendingRevisions.length },
      },
    });

    return p;
  });

  return {
    ...withMeta(updated),
    clientUrl: publicUrl,
    version,
    message: `Proposal v${version} sent. Client link updated with latest version.`,
  };
}

export async function requestRevision(
  token: string,
  dto: z.infer<typeof requestRevisionSchema>,
) {
  const proposal = await prisma.proposal.findUnique({ where: { publicToken: token } });
  if (!proposal) {
    throw new ProposalHttpError("Proposal not found", 404);
  }
  if (proposal.status === ProposalStatus.ACCEPTED) {
    throw new ProposalHttpError(
      "Proposal already accepted — contact your account manager",
      400,
    );
  }
  if (!proposal.sentAt) {
    throw new ProposalHttpError("Proposal has not been sent yet", 400);
  }

  const [revision, updated] = await prisma.$transaction(async (tx) => {
    const rev = await tx.proposalRevisionRequest.create({
      data: {
        proposalId: proposal.id,
        versionAtRequest: proposal.currentVersion,
        requestedByName: dto.requestedByName,
        requestedByEmail: dto.requestedByEmail,
        comments: dto.comments,
      },
    });

    const p = await tx.proposal.update({
      where: { id: proposal.id },
      data: { status: ProposalStatus.REVISION_REQUESTED },
      include: PROPOSAL_INCLUDE,
    });

    await tx.auditLog.create({
      data: {
        entityType: "Proposal",
        entityId: proposal.id,
        action: "PROPOSAL_REVISION_REQUESTED",
        metadata: {
          revisionId: rev.id,
          version: proposal.currentVersion,
          requestedByName: dto.requestedByName,
          comments: dto.comments,
        },
      },
    });

    return [rev, p] as const;
  });

  return {
    revision,
    proposal: withMeta(updated),
    message: "Revision request received. The team will update and resend the proposal.",
  };
}

export async function getProposalHistory(leadId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { leadId },
    include: {
      sendLogs: {
        orderBy: { sentAt: "desc" },
        include: { sentBy: { select: { name: true } } },
      },
      revisionRequests: { orderBy: { requestedAt: "desc" } },
    },
  });
  if (!proposal) {
    throw new ProposalHttpError("Proposal not found", 404);
  }

  return {
    currentVersion: proposal.currentVersion,
    sendLogs: proposal.sendLogs,
    revisionRequests: proposal.revisionRequests,
  };
}

export async function acceptProposal(
  leadId: string,
  dto: z.infer<typeof acceptProposalSchema>,
  actorId?: string,
) {
  const proposal = await prisma.proposal.findUnique({ where: { leadId } });
  if (!proposal) {
    throw new ProposalHttpError("Proposal not found", 404);
  }
  if (proposal.status === ProposalStatus.ACCEPTED) {
    throw new ProposalHttpError("Proposal already accepted", 400);
  }
  if (!proposal.sentAt) {
    throw new ProposalHttpError("Proposal must be sent before it can be accepted", 400);
  }

  const pending = await prisma.proposalRevisionRequest.count({
    where: {
      proposalId: proposal.id,
      status: {
        in: [RevisionRequestStatus.PENDING, RevisionRequestStatus.IN_PROGRESS],
      },
    },
  });
  if (pending > 0) {
    throw new ProposalHttpError(
      "Resolve pending revision requests before acceptance",
      400,
    );
  }

  const now = new Date();
  const updated = await prisma.proposal.update({
    where: { leadId },
    data: {
      status: ProposalStatus.ACCEPTED,
      acceptedAt: now,
      acceptedByName: dto.acceptedByName,
      acceptedByEmail: dto.acceptedByEmail,
    },
    include: PROPOSAL_INCLUDE,
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { stage: LeadStage.CLOSED_WON, stageChangedAt: now },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      entityType: "Proposal",
      entityId: updated.id,
      action: "PROPOSAL_ACCEPTED",
      metadata: {
        acceptedByName: dto.acceptedByName,
        acceptedByEmail: dto.acceptedByEmail,
        leadId,
        version: proposal.currentVersion,
      },
    },
  });

  const { workspace } = await convertLead(leadId);
  const project = workspace.projects[0];
  if (!project) {
    throw new ProposalHttpError("Failed to create project", 400);
  }

  const invoice = await createInvoiceOnAccept({
    workspaceId: workspace.id,
    projectId: project.id,
    proposalId: updated.id,
    billingFlow: updated.billingFlow,
    investment: updated.investment,
    deliverables: updated.deliverables,
    isAdvance: true,
  });

  const refreshed = await getWorkspace(workspace.id);
  const billingUrl = refreshed.billingToken
    ? `${getWebOrigin()}/c/${refreshed.billingToken}`
    : null;

  const flowMessage =
    updated.billingFlow === BillingFlow.DRAFT_FIRST
      ? "Proposal accepted. Draft invoice is ready for client download."
      : "Proposal accepted. Advance tax invoice raised.";

  return {
    proposal: withMeta(updated),
    workspace: refreshed,
    invoice,
    billingUrl,
    message: flowMessage,
  };
}

export async function acceptProposalByToken(
  token: string,
  dto: z.infer<typeof acceptProposalSchema>,
) {
  const proposal = await prisma.proposal.findUnique({ where: { publicToken: token } });
  if (!proposal) {
    throw new ProposalHttpError("Proposal not found", 404);
  }
  return acceptProposal(proposal.leadId, dto);
}

export async function getCaseStudies() {
  return prisma.caseStudy.findMany({ orderBy: { title: "asc" } });
}

export function handleProposalError(error: unknown) {
  if (error instanceof ProposalHttpError) {
    return { message: error.message, status: error.status };
  }
  throw error;
}
