import { randomBytes } from "crypto";
import {
  BillingFlow,
  InvoiceDocumentType,
  InvoiceStatus,
  MilestoneStatus,
  PaymentMode,
  ProjectStatus,
} from "@prisma/client";
import { z } from "zod";
import {
  MILESTONE_TEMPLATES,
  splitsFromTemplate,
} from "@/lib/server/milestone-templates";
import { prisma } from "@/lib/server/prisma";
import { getAgencyProfile } from "@/lib/server/settings";

const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

export const INVOICE_INCLUDE = {
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

export class InvoiceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const setMilestonesSchema = z.object({
  templateKey: z.string().optional(),
  milestones: z
    .array(
      z.object({
        label: z.string(),
        amount: z.number(),
        dueDate: z.string().optional(),
        sortOrder: z.number().optional(),
      }),
    )
    .optional(),
});

export const sendMilestoneNotificationSchema = z.object({
  internalNote: z.string().optional(),
});

export const updateInvoiceNumberingSchema = z.object({
  draftInvoicePrefix: z.string().optional(),
  draftInvoiceNextSeq: z.number().optional(),
  taxInvoicePrefix: z.string().optional(),
  taxInvoiceNextSeq: z.number().optional(),
  receiptPrefix: z.string().optional(),
  receiptNextSeq: z.number().optional(),
});

export const recordPaymentSchema = z.object({
  paymentMode: z.enum(PaymentMode),
  amount: z.number().optional(),
  paymentReference: z.string().optional(),
  paidAt: z.string().optional(),
  milestoneId: z.string().optional(),
});

export const requestTaxInvoiceSchema = z.object({
  requestedByName: z.string().min(1),
  requestedByEmail: z.string().optional(),
});

export const issueTaxInvoiceSchema = z.object({
  internalNote: z.string().optional(),
});

function formatNumber(prefix: string, seq: number) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

async function nextNumber(type: InvoiceDocumentType) {
  const profile = await getAgencyProfile();
  if (type === InvoiceDocumentType.DRAFT) {
    const number = formatNumber(profile.draftInvoicePrefix, profile.draftInvoiceNextSeq);
    await prisma.agencyProfile.update({
      where: { id: "default" },
      data: { draftInvoiceNextSeq: profile.draftInvoiceNextSeq + 1 },
    });
    return number;
  }
  if (type === InvoiceDocumentType.RECEIPT) {
    const number = formatNumber(profile.receiptPrefix, profile.receiptNextSeq);
    await prisma.agencyProfile.update({
      where: { id: "default" },
      data: { receiptNextSeq: profile.receiptNextSeq + 1 },
    });
    return number;
  }
  const number = formatNumber(profile.taxInvoicePrefix, profile.taxInvoiceNextSeq);
  await prisma.agencyProfile.update({
    where: { id: "default" },
    data: { taxInvoiceNextSeq: profile.taxInvoiceNextSeq + 1 },
  });
  return number;
}

function paidTotal(receipts: { amount: { toString(): string } | number }[]) {
  return receipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0);
}

export function withInvoiceMeta<
  T extends {
    id: string;
    number: string;
    documentType: InvoiceDocumentType;
    status: InvoiceStatus;
    amount: { toString(): string } | number;
    publicToken: string | null;
    workspace: { name: string; company: string | null; billingToken: string | null };
    receipts?: { amount: { toString(): string } | number }[];
  },
>(invoice: T) {
  const billingUrl = invoice.workspace.billingToken
    ? `${WEB_ORIGIN}/c/${invoice.workspace.billingToken}`
    : null;
  const publicUrl = invoice.publicToken
    ? `${WEB_ORIGIN}/d/${invoice.publicToken}`
    : null;

  const totalAmount = Number(invoice.amount);
  const amountPaid =
    invoice.receipts?.reduce((sum, receipt) => sum + Number(receipt.amount), 0) ?? 0;
  const amountDue = Math.max(0, totalAmount - amountPaid);

  return {
    ...invoice,
    billingUrl,
    publicUrl,
    amountPaid,
    amountDue,
    typeLabel:
      invoice.documentType === InvoiceDocumentType.DRAFT
        ? "Draft invoice"
        : invoice.documentType === InvoiceDocumentType.RECEIPT
          ? "Payment receipt"
          : invoice.status === InvoiceStatus.REQUESTED
            ? "Tax invoice requested"
            : "Tax invoice",
  };
}

function buildBillingSteps(
  billingFlow: BillingFlow,
  draft: { status: InvoiceStatus } | undefined,
  tax: { status: InvoiceStatus; paidAt: Date | null } | undefined,
  receipts: { id: string }[],
) {
  if (billingFlow === BillingFlow.DIRECT) {
    return [
      { key: "proposal", label: "Proposal accepted", done: true },
      { key: "invoice", label: "Advance invoice", done: !!tax, active: !tax },
      {
        key: "paid",
        label: "Payment received",
        done: tax?.status === InvoiceStatus.PAID,
        active: tax?.status === InvoiceStatus.SENT,
      },
    ];
  }
  return [
    { key: "proposal", label: "Proposal accepted", done: true },
    { key: "draft", label: "Draft invoice", done: !!draft, active: !draft },
    {
      key: "tax_request",
      label: "Tax invoice requested",
      done: !!tax || draft?.status === InvoiceStatus.REQUESTED,
      active: !!draft && !tax,
    },
    {
      key: "tax",
      label: "Tax invoice issued",
      done:
        tax?.status === InvoiceStatus.PAID || tax?.status === InvoiceStatus.SENT,
      active: tax?.status === InvoiceStatus.REQUESTED,
    },
    {
      key: "paid",
      label: "Payment recorded",
      done: receipts.length > 0 || tax?.status === InvoiceStatus.PAID,
      active: tax?.status === InvoiceStatus.SENT,
    },
  ];
}

export async function findInvoiceById(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: INVOICE_INCLUDE,
  });
  if (!invoice) throw new InvoiceHttpError("Invoice not found", 404);
  return withInvoiceMeta(invoice);
}

export async function getMilestoneTemplates() {
  return MILESTONE_TEMPLATES;
}

export async function findAllInvoices(filters?: {
  documentType?: InvoiceDocumentType;
  status?: InvoiceStatus;
}) {
  const invoices = await prisma.invoice.findMany({
    where: {
      documentType: filters?.documentType,
      status: filters?.status,
    },
    include: INVOICE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return invoices.map((invoice) => withInvoiceMeta(invoice));
}

export async function getNumberingSettings() {
  const profile = await getAgencyProfile();
  return {
    draftInvoicePrefix: profile.draftInvoicePrefix,
    draftInvoiceNextSeq: profile.draftInvoiceNextSeq,
    taxInvoicePrefix: profile.taxInvoicePrefix,
    taxInvoiceNextSeq: profile.taxInvoiceNextSeq,
    receiptPrefix: profile.receiptPrefix,
    receiptNextSeq: profile.receiptNextSeq,
  };
}

export async function updateNumberingSettings(
  dto: z.infer<typeof updateInvoiceNumberingSchema>,
) {
  return prisma.agencyProfile.update({
    where: { id: "default" },
    data: dto,
  });
}

export async function getBillingPortal(token: string) {
  const workspace = await prisma.clientWorkspace.findUnique({
    where: { billingToken: token },
    include: {
      invoices: {
        include: { receipts: true, relatedInvoice: true },
        orderBy: { createdAt: "asc" },
      },
      projects: true,
    },
  });
  if (!workspace) throw new InvoiceHttpError("Billing link not found", 404);

  const agency = await getAgencyProfile();
  const proposal = workspace.leadId
    ? await prisma.proposal.findUnique({
        where: { leadId: workspace.leadId },
        include: { lead: true },
      })
    : null;

  const draftInvoice = workspace.invoices.find(
    (i) => i.documentType === InvoiceDocumentType.DRAFT,
  );
  const taxInvoices = workspace.invoices.filter(
    (i) => i.documentType === InvoiceDocumentType.TAX,
  );
  const receipts = workspace.invoices.filter(
    (i) => i.documentType === InvoiceDocumentType.RECEIPT,
  );

  const pendingTaxRequest = taxInvoices.find(
    (i) => i.status === InvoiceStatus.REQUESTED,
  );
  const activeTaxInvoice = taxInvoices.find(
    (i) =>
      i.status === InvoiceStatus.SENT ||
      i.status === InvoiceStatus.PARTIALLY_PAID ||
      i.status === InvoiceStatus.PAID ||
      i.status === InvoiceStatus.OVERDUE,
  );

  const taxInvoiceDetail = activeTaxInvoice
    ? await findInvoiceById(activeTaxInvoice.id)
    : null;

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      company: workspace.company,
      billingFlow: workspace.billingFlow,
    },
    agency,
    proposal: proposal
      ? {
          proposalNumber: proposal.proposalNumber,
          acceptedAt: proposal.acceptedAt,
          acceptedByName: proposal.acceptedByName,
          investment: proposal.investment,
          deliverables: proposal.deliverables,
        }
      : null,
    draftInvoice: draftInvoice
      ? withInvoiceMeta({ ...draftInvoice, workspace })
      : null,
    taxInvoice: taxInvoiceDetail,
    pendingTaxRequest: pendingTaxRequest
      ? withInvoiceMeta({ ...pendingTaxRequest, workspace })
      : null,
    receipts: receipts.map((r) => withInvoiceMeta({ ...r, workspace })),
    steps: buildBillingSteps(
      workspace.billingFlow,
      draftInvoice,
      activeTaxInvoice,
      receipts,
    ),
    milestones: taxInvoiceDetail?.paymentMilestones ?? [],
  };
}

export async function getPublicDocument(token: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { publicToken: token },
    include: INVOICE_INCLUDE,
  });
  if (!invoice) throw new InvoiceHttpError("Document not found", 404);
  const agency = await getAgencyProfile();
  return { invoice: withInvoiceMeta(invoice), agency };
}

export async function requestTaxInvoice(
  billingToken: string,
  dto: z.infer<typeof requestTaxInvoiceSchema>,
) {
  const workspace = await prisma.clientWorkspace.findUnique({
    where: { billingToken },
    include: { invoices: true },
  });
  if (!workspace) throw new InvoiceHttpError("Billing link not found", 404);
  if (workspace.billingFlow !== BillingFlow.DRAFT_FIRST) {
    throw new InvoiceHttpError("Tax invoice request is only for draft-first billing", 400);
  }

  const draft = workspace.invoices.find(
    (i) => i.documentType === InvoiceDocumentType.DRAFT,
  );
  if (!draft) throw new InvoiceHttpError("No draft invoice found", 400);

  const existing = workspace.invoices.find(
    (i) =>
      i.documentType === InvoiceDocumentType.TAX &&
      i.status !== InvoiceStatus.CANCELLED,
  );
  if (existing) {
    throw new InvoiceHttpError("Tax invoice already exists or requested", 400);
  }

  const number = await nextNumber(InvoiceDocumentType.TAX);
  const taxInvoice = await prisma.invoice.create({
    data: {
      workspaceId: workspace.id,
      projectId: draft.projectId,
      proposalId: draft.proposalId,
      number,
      documentType: InvoiceDocumentType.TAX,
      amount: draft.amount,
      description: "Tax invoice — requested by client",
      lineItems: draft.lineItems ?? undefined,
      status: InvoiceStatus.REQUESTED,
      requestedAt: new Date(),
      requestedByName: dto.requestedByName,
      requestedByEmail: dto.requestedByEmail,
      publicToken: randomBytes(18).toString("hex"),
    },
    include: INVOICE_INCLUDE,
  });

  await prisma.auditLog.create({
    data: {
      entityType: "Invoice",
      entityId: taxInvoice.id,
      action: "TAX_INVOICE_REQUESTED",
      metadata: { requestedByName: dto.requestedByName, workspaceId: workspace.id },
    },
  });

  return {
    message: "Tax invoice request received. We will issue your tax invoice shortly.",
    taxInvoice: withInvoiceMeta(taxInvoice),
  };
}

export async function setMilestones(
  invoiceId: string,
  dto: z.infer<typeof setMilestonesSchema>,
  actorId?: string,
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { paymentMilestones: true },
  });
  if (!invoice) throw new InvoiceHttpError("Invoice not found", 404);
  if (invoice.documentType !== InvoiceDocumentType.TAX) {
    throw new InvoiceHttpError("Milestones can only be set on tax invoices", 400);
  }

  const paidMilestones = invoice.paymentMilestones.filter(
    (m) => m.status === MilestoneStatus.PAID,
  );
  if (paidMilestones.length > 0) {
    throw new InvoiceHttpError(
      "Cannot change milestones after payments have been recorded",
      400,
    );
  }

  const totalAmount = Number(invoice.amount);
  let items = dto.milestones;

  if (dto.templateKey) {
    const fromTemplate = splitsFromTemplate(dto.templateKey, totalAmount);
    if (!fromTemplate) throw new InvoiceHttpError("Unknown milestone template", 400);
    items = fromTemplate;
  }

  if (!items?.length) {
    throw new InvoiceHttpError("Provide a template or custom milestones", 400);
  }

  const sum = items.reduce((acc, m) => acc + m.amount, 0);
  if (Math.abs(sum - totalAmount) > 1) {
    throw new InvoiceHttpError(
      `Milestone amounts must total ₹${totalAmount} (currently ₹${sum})`,
      400,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentMilestone.deleteMany({
      where: { invoiceId, status: MilestoneStatus.PENDING },
    });

    await tx.paymentMilestone.createMany({
      data: items!.map((m, index) => ({
        invoiceId,
        label: m.label,
        amount: m.amount,
        dueDate: m.dueDate ? new Date(m.dueDate) : undefined,
        sortOrder: m.sortOrder ?? index,
        status: MilestoneStatus.PENDING,
      })),
    });
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      entityType: "Invoice",
      entityId: invoiceId,
      action: "MILESTONES_SET",
      metadata: { templateKey: dto.templateKey, count: items.length },
    },
  });

  return findInvoiceById(invoiceId);
}

export async function sendMilestoneNotification(
  milestoneId: string,
  dto: z.infer<typeof sendMilestoneNotificationSchema> = {},
  actorId?: string,
) {
  const milestone = await prisma.paymentMilestone.findUnique({
    where: { id: milestoneId },
    include: {
      invoice: {
        include: {
          workspace: true,
          proposal: { include: { lead: true } },
        },
      },
      notifications: { orderBy: { sentAt: "desc" }, take: 3 },
    },
  });
  if (!milestone) throw new InvoiceHttpError("Milestone not found", 404);
  if (milestone.status === MilestoneStatus.PAID) {
    throw new InvoiceHttpError("Cannot notify for a paid milestone", 400);
  }

  const invoice = milestone.invoice;
  const workspace = invoice.workspace;
  const agency = await getAgencyProfile();
  const clientName = workspace.name;
  const clientEmail = workspace.email || invoice.proposal?.lead?.email;
  const billingUrl = workspace.billingToken
    ? `${WEB_ORIGIN}/c/${workspace.billingToken}`
    : null;
  const amount = Number(milestone.amount).toLocaleString("en-IN");
  const dueLine = milestone.dueDate
    ? `Due by ${milestone.dueDate.toLocaleDateString("en-IN")}.`
    : "Please arrange payment at your earliest convenience.";

  const message =
    `Hi ${clientName},\n\n` +
    `This is a payment reminder for *${milestone.label}* on invoice ${invoice.number}.\n\n` +
    `Amount due: ₹${amount}\n${dueLine}\n\n` +
    `View invoice and bank details: ${billingUrl || "contact us for payment details"}\n\n` +
    `Thank you,\n${agency.name}`;

  const notification = await prisma.paymentMilestoneNotification.create({
    data: {
      milestoneId,
      sentById: actorId,
      message,
      internalNote: dto.internalNote,
    },
    include: { sentBy: { select: { id: true, name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      entityType: "PaymentMilestone",
      entityId: milestoneId,
      action: "PAYMENT_NOTIFICATION_SENT",
      metadata: {
        invoiceNumber: invoice.number,
        milestoneLabel: milestone.label,
        amount: Number(milestone.amount),
      },
    },
  });

  const whatsappText = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;
  const mailtoUrl = clientEmail
    ? `mailto:${clientEmail}?subject=${encodeURIComponent(`Payment due — ${milestone.label}`)}&body=${encodeURIComponent(message)}`
    : null;

  return {
    notification,
    message: "Payment notification logged. Share via WhatsApp or email below.",
    clientName,
    clientEmail,
    billingUrl,
    notificationText: message,
    whatsappUrl,
    mailtoUrl,
    milestone: {
      id: milestone.id,
      label: milestone.label,
      amount: Number(milestone.amount),
      status: milestone.status,
      notifications: [notification, ...milestone.notifications],
    },
  };
}

export async function issueTaxInvoice(
  invoiceId: string,
  dto: z.infer<typeof issueTaxInvoiceSchema> = {},
  actorId?: string,
) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new InvoiceHttpError("Invoice not found", 404);
  if (invoice.documentType !== InvoiceDocumentType.TAX) {
    throw new InvoiceHttpError("Only tax invoices can be issued", 400);
  }
  if (invoice.status !== InvoiceStatus.REQUESTED && invoice.status !== InvoiceStatus.DRAFT) {
    throw new InvoiceHttpError("Invoice is not in a state that can be issued", 400);
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: InvoiceStatus.SENT,
      sentAt: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      description: dto.internalNote
        ? `Tax invoice — ${dto.internalNote}`
        : invoice.description,
    },
    include: INVOICE_INCLUDE,
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      entityType: "Invoice",
      entityId: invoiceId,
      action: "TAX_INVOICE_ISSUED",
      metadata: { number: updated.number },
    },
  });

  return withInvoiceMeta(updated);
}

export async function recordPayment(
  invoiceId: string,
  dto: z.infer<typeof recordPaymentSchema>,
  actorId?: string,
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      workspace: true,
      receipts: true,
      paymentMilestones: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) throw new InvoiceHttpError("Invoice not found", 404);
  if (invoice.documentType === InvoiceDocumentType.RECEIPT) {
    throw new InvoiceHttpError("Cannot record payment on a receipt", 400);
  }
  if (invoice.documentType === InvoiceDocumentType.DRAFT) {
    throw new InvoiceHttpError(
      "Record payments against the tax invoice, not the draft",
      400,
    );
  }
  if (invoice.status === InvoiceStatus.PAID) {
    throw new InvoiceHttpError("Invoice is fully paid", 400);
  }

  const milestones = invoice.paymentMilestones;
  const pendingMilestones = milestones.filter((m) => m.status === MilestoneStatus.PENDING);

  if (pendingMilestones.length > 0 && !dto.milestoneId) {
    throw new InvoiceHttpError(
      "Select which payment milestone this payment is for",
      400,
    );
  }

  let milestone: (typeof milestones)[0] | undefined;
  if (dto.milestoneId) {
    milestone = milestones.find((m) => m.id === dto.milestoneId);
    if (!milestone) throw new InvoiceHttpError("Milestone not found", 404);
    if (milestone.status === MilestoneStatus.PAID) {
      throw new InvoiceHttpError("This milestone is already paid", 400);
    }
  }

  const totalAmount = Number(invoice.amount);
  const alreadyPaid = paidTotal(invoice.receipts);
  const remaining = totalAmount - alreadyPaid;
  if (remaining <= 0) {
    throw new InvoiceHttpError("Invoice is already fully paid", 400);
  }

  const paymentAmount = milestone ? Number(milestone.amount) : (dto.amount ?? remaining);
  if (paymentAmount <= 0) {
    throw new InvoiceHttpError("Payment amount must be greater than zero", 400);
  }
  if (paymentAmount > remaining) {
    throw new InvoiceHttpError(`Payment exceeds balance due (₹${remaining})`, 400);
  }
  if (milestone && Math.abs(paymentAmount - Number(milestone.amount)) > 0.01) {
    throw new InvoiceHttpError(
      `Payment must match milestone amount (₹${milestone.amount})`,
      400,
    );
  }

  const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
  const newPaidTotal = alreadyPaid + paymentAmount;
  const isFullyPaid = newPaidTotal >= totalAmount;
  const receiptLabel = milestone
    ? milestone.label
    : isFullyPaid
      ? "Full payment"
      : "Partial payment";

  const updated = await prisma.$transaction(async (tx) => {
    const profile = await getAgencyProfile();
    const receiptNumber = formatNumber(profile.receiptPrefix, profile.receiptNextSeq);
    await tx.agencyProfile.update({
      where: { id: "default" },
      data: { receiptNextSeq: profile.receiptNextSeq + 1 },
    });

    const receipt = await tx.invoice.create({
      data: {
        workspaceId: invoice.workspaceId,
        projectId: invoice.projectId,
        proposalId: invoice.proposalId,
        number: receiptNumber,
        documentType: InvoiceDocumentType.RECEIPT,
        amount: paymentAmount,
        description: `Receipt — ${receiptLabel} for ${invoice.number}`,
        status: InvoiceStatus.PAID,
        paidAt,
        paymentMode: dto.paymentMode,
        paymentReference: dto.paymentReference,
        relatedInvoiceId: invoice.id,
        sentAt: paidAt,
        publicToken: randomBytes(18).toString("hex"),
      },
    });

    if (milestone) {
      await tx.paymentMilestone.update({
        where: { id: milestone.id },
        data: { status: MilestoneStatus.PAID, paidAt, receiptId: receipt.id },
      });
    }

    const paid = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: isFullyPaid ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
        paidAt: isFullyPaid ? paidAt : invoice.paidAt,
        paymentMode: isFullyPaid ? dto.paymentMode : invoice.paymentMode,
        paymentReference: isFullyPaid ? dto.paymentReference : invoice.paymentReference,
      },
    });

    const isFirstPayment = invoice.receipts.length === 0;
    const isFirstMilestone = milestone?.sortOrder === 0;
    if (invoice.projectId && isFirstPayment && (invoice.isAdvance || isFirstMilestone)) {
      await tx.project.update({
        where: { id: invoice.projectId },
        data: { status: ProjectStatus.ACTIVE, advancePaidAt: paidAt },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId,
        entityType: "Invoice",
        entityId: invoice.id,
        action: "PAYMENT_RECORDED",
        metadata: {
          paymentMode: dto.paymentMode,
          paymentReference: dto.paymentReference,
          receiptNumber: receipt.number,
          amount: paymentAmount,
          milestoneId: milestone?.id,
          milestoneLabel: milestone?.label,
          balanceRemaining: totalAmount - newPaidTotal,
        },
      },
    });

    return { paid, receipt };
  });

  const full = await findInvoiceById(updated.paid.id);
  return {
    invoice: full,
    receipt: await findInvoiceById(updated.receipt.id),
    message: isFullyPaid
      ? "Payment recorded. Invoice fully paid — receipt generated."
      : `Partial payment of ₹${paymentAmount} recorded. Receipt generated. ₹${totalAmount - newPaidTotal} remaining.`,
  };
}

export function handleInvoiceError(error: unknown) {
  if (error instanceof InvoiceHttpError) {
    return { message: error.message, status: error.status };
  }
  throw error;
}
