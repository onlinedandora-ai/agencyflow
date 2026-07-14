import * as crypto from "crypto";
import {
  InvoiceDocumentType,
  InvoiceStatus,
  PaymentClaimStatus,
  PaymentMode,
  RazorpayOrderStatus,
} from "@prisma/client";
import Razorpay from "razorpay";
import { z } from "zod";
import { InvoiceHttpError, recordPayment } from "@/lib/server/invoices";
import { prisma } from "@/lib/server/prisma";

const MAX_PROOF_BYTES = 1_500_000;

let razorpayClient: Razorpay | null = null;

function getRazorpayClient() {
  if (razorpayClient) return razorpayClient;
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (keyId && keySecret) {
    razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpayClient;
}

export class PaymentHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const createRazorpayOrderSchema = z.object({
  invoiceId: z.string().min(1),
  milestoneId: z.string().optional(),
  payerName: z.string().min(1),
  payerEmail: z.string().optional(),
});

export const verifyRazorpayPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const submitPaymentClaimSchema = z.object({
  invoiceId: z.string().min(1),
  milestoneId: z.string().optional(),
  amount: z.number(),
  paymentMode: z.enum(PaymentMode),
  paymentReference: z.string().max(120).optional(),
  submittedByName: z.string().min(1).max(120),
  submittedByEmail: z.string().optional(),
  proofNote: z.string().optional(),
  proofDataUrl: z.string().optional(),
});

export const reviewPaymentClaimSchema = z.object({
  reviewNote: z.string().optional(),
});

export function getRazorpayPublicConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return { enabled: false as const };
  return { enabled: true as const, keyId };
}

function requireRazorpayClient() {
  const client = getRazorpayClient();
  if (!client) {
    throw new PaymentHttpError(
      "Online payments are not configured. Use bank transfer instead.",
      503,
    );
  }
  return client;
}

async function workspaceByToken(token: string) {
  const workspace = await prisma.clientWorkspace.findUnique({
    where: { billingToken: token },
  });
  if (!workspace) {
    throw new PaymentHttpError("Client portal link not found", 404);
  }
  return workspace;
}

async function resolvePayableAmount(
  invoiceId: string,
  workspaceId: string,
  milestoneId?: string,
) {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      workspaceId,
      documentType: InvoiceDocumentType.TAX,
      status: {
        in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE],
      },
    },
    include: {
      receipts: true,
      paymentMilestones: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) {
    throw new PaymentHttpError("No payable invoice found", 400);
  }

  const totalAmount = Number(invoice.amount);
  const alreadyPaid = invoice.receipts.reduce((sum, r) => sum + Number(r.amount), 0);
  const remaining = totalAmount - alreadyPaid;
  if (remaining <= 0) {
    throw new PaymentHttpError("Invoice is already fully paid", 400);
  }

  if (milestoneId) {
    const milestone = invoice.paymentMilestones.find((m) => m.id === milestoneId);
    if (!milestone) throw new PaymentHttpError("Milestone not found", 404);
    if (milestone.status === "PAID") {
      throw new PaymentHttpError("This milestone is already paid", 400);
    }
    return { invoice, amount: Number(milestone.amount), milestone };
  }

  const pendingMilestones = invoice.paymentMilestones.filter((m) => m.status === "PENDING");
  if (pendingMilestones.length > 0) {
    throw new PaymentHttpError("Select which payment milestone to pay", 400);
  }

  return { invoice, amount: remaining, milestone: undefined };
}

function verifySignature(orderId: string, paymentId: string, signature: string) {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}

export async function createRazorpayOrder(
  token: string,
  dto: z.infer<typeof createRazorpayOrderSchema>,
) {
  const client = requireRazorpayClient();
  const workspace = await workspaceByToken(token);
  const { invoice, amount, milestone } = await resolvePayableAmount(
    dto.invoiceId,
    workspace.id,
    dto.milestoneId,
  );

  const amountPaise = Math.round(amount * 100);
  if (amountPaise < 100) {
    throw new PaymentHttpError("Payment amount must be at least ₹1", 400);
  }

  const receipt = `${invoice.number}-${Date.now()}`.slice(0, 40);
  const order = await client.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt,
    notes: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      workspaceId: workspace.id,
      milestoneId: milestone?.id ?? "",
    },
  });

  const record = await prisma.razorpayOrder.create({
    data: {
      invoiceId: invoice.id,
      milestoneId: milestone?.id,
      razorpayOrderId: order.id,
      amount,
      amountPaise,
      payerName: dto.payerName,
      payerEmail: dto.payerEmail,
    },
  });

  return {
    orderId: order.id,
    amount: amountPaise,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID!.trim(),
    invoiceNumber: invoice.number,
    milestoneLabel: milestone?.label ?? null,
    localOrderId: record.id,
    prefill: {
      name: dto.payerName,
      email: dto.payerEmail ?? workspace.email ?? undefined,
    },
  };
}

export async function verifyRazorpayPayment(
  token: string,
  dto: z.infer<typeof verifyRazorpayPaymentSchema>,
) {
  const workspace = await workspaceByToken(token);

  if (
    !verifySignature(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature)
  ) {
    throw new PaymentHttpError("Payment verification failed — invalid signature", 400);
  }

  const order = await prisma.razorpayOrder.findUnique({
    where: { razorpayOrderId: dto.razorpay_order_id },
    include: { invoice: true, milestone: true },
  });
  if (!order) throw new PaymentHttpError("Payment order not found", 404);
  if (order.invoice.workspaceId !== workspace.id) {
    throw new PaymentHttpError("Payment does not belong to this workspace", 400);
  }
  if (order.status === RazorpayOrderStatus.PAID) {
    return {
      message: "Payment already recorded",
      alreadyPaid: true,
    };
  }

  const duplicate = await prisma.invoice.findFirst({
    where: { paymentReference: dto.razorpay_payment_id },
  });
  if (duplicate) {
    await prisma.razorpayOrder.update({
      where: { id: order.id },
      data: {
        status: RazorpayOrderStatus.PAID,
        paymentId: dto.razorpay_payment_id,
        paidAt: new Date(),
      },
    });
    return { message: "Payment already recorded", alreadyPaid: true };
  }

  const result = await recordPayment(order.invoiceId, {
    paymentMode: PaymentMode.ONLINE,
    amount: Number(order.amount),
    paymentReference: dto.razorpay_payment_id,
    milestoneId: order.milestoneId ?? undefined,
  });

  await prisma.razorpayOrder.update({
    where: { id: order.id },
    data: {
      status: RazorpayOrderStatus.PAID,
      paymentId: dto.razorpay_payment_id,
      paidAt: new Date(),
    },
  });

  return {
    ...result,
    message: "Payment successful — receipt generated.",
    alreadyPaid: false,
  };
}

function validateProof(proofDataUrl?: string) {
  if (!proofDataUrl) {
    throw new PaymentHttpError("Payment screenshot is required", 400);
  }
  if (!proofDataUrl.startsWith("data:image/")) {
    throw new PaymentHttpError("Payment proof must be an image file", 400);
  }
  if (proofDataUrl.length > MAX_PROOF_BYTES) {
    throw new PaymentHttpError("Payment screenshot is too large (max ~1 MB)", 400);
  }
}

export async function submitPaymentClaim(
  token: string,
  dto: z.infer<typeof submitPaymentClaimSchema>,
) {
  const workspace = await workspaceByToken(token);
  validateProof(dto.proofDataUrl);

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: dto.invoiceId,
      workspaceId: workspace.id,
      documentType: InvoiceDocumentType.TAX,
      status: {
        in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE],
      },
    },
    include: { paymentMilestones: true },
  });
  if (!invoice) {
    throw new PaymentHttpError("No payable invoice found for this payment", 400);
  }

  const existingPending = await prisma.paymentClaim.findFirst({
    where: {
      invoiceId: invoice.id,
      milestoneId: dto.milestoneId ?? null,
      status: PaymentClaimStatus.PENDING,
    },
  });
  if (existingPending) {
    throw new PaymentHttpError(
      "A payment confirmation is already pending review for this invoice",
      400,
    );
  }

  if (dto.milestoneId) {
    const milestone = invoice.paymentMilestones.find((m) => m.id === dto.milestoneId);
    if (!milestone) throw new PaymentHttpError("Milestone not found", 404);
    if (milestone.status === "PAID") {
      throw new PaymentHttpError("This milestone is already paid", 400);
    }
  }

  const claim = await prisma.paymentClaim.create({
    data: {
      invoiceId: invoice.id,
      milestoneId: dto.milestoneId,
      amount: dto.amount,
      paymentMode: dto.paymentMode,
      paymentReference: dto.paymentReference,
      proofDataUrl: dto.proofDataUrl,
      proofNote: dto.proofNote,
      submittedByName: dto.submittedByName,
      submittedByEmail: dto.submittedByEmail,
    },
  });

  return {
    message: "Payment submitted for review. We will validate and share your receipt shortly.",
    claimId: claim.id,
  };
}

export async function listPaymentClaims(status?: PaymentClaimStatus) {
  return prisma.paymentClaim.findMany({
    where: status ? { status } : undefined,
    include: {
      invoice: {
        select: {
          number: true,
          workspace: { select: { id: true, name: true, company: true } },
        },
      },
      milestone: { select: { label: true } },
      reviewedBy: { select: { name: true } },
    },
    orderBy: { submittedAt: "desc" },
  });
}

async function getPaymentClaim(id: string) {
  const claim = await prisma.paymentClaim.findUnique({
    where: { id },
    include: {
      invoice: {
        select: {
          id: true,
          number: true,
          workspace: { select: { id: true, name: true, company: true } },
        },
      },
      milestone: { select: { id: true, label: true } },
    },
  });
  if (!claim) throw new PaymentHttpError("Payment claim not found", 404);
  return claim;
}

export async function approvePaymentClaim(
  id: string,
  actorId: string,
  dto: z.infer<typeof reviewPaymentClaimSchema>,
) {
  const claim = await getPaymentClaim(id);
  if (claim.status !== PaymentClaimStatus.PENDING) {
    throw new PaymentHttpError("Claim is not pending", 400);
  }

  const result = await recordPayment(
    claim.invoice.id,
    {
      paymentMode: claim.paymentMode as PaymentMode,
      amount: Number(claim.amount),
      paymentReference: claim.paymentReference ?? `Client claim ${claim.id.slice(-6)}`,
      milestoneId: claim.milestone?.id,
    },
    actorId,
  );

  await prisma.paymentClaim.update({
    where: { id },
    data: {
      status: PaymentClaimStatus.APPROVED,
      reviewedAt: new Date(),
      reviewedById: actorId,
      reviewNote: dto.reviewNote,
    },
  });

  return {
    ...result,
    message: "Payment validated — receipt issued to client.",
  };
}

export async function rejectPaymentClaim(
  id: string,
  actorId: string,
  dto: z.infer<typeof reviewPaymentClaimSchema>,
) {
  const claim = await getPaymentClaim(id);
  if (claim.status !== PaymentClaimStatus.PENDING) {
    throw new PaymentHttpError("Claim is not pending", 400);
  }
  if (!dto.reviewNote?.trim()) {
    throw new PaymentHttpError("Please provide a reason for rejection", 400);
  }

  await prisma.paymentClaim.update({
    where: { id },
    data: {
      status: PaymentClaimStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedById: actorId,
      reviewNote: dto.reviewNote,
    },
  });

  return {
    message: "Payment claim rejected — client can resubmit with corrected proof.",
  };
}

export function handlePaymentError(error: unknown) {
  if (error instanceof PaymentHttpError) {
    return { message: error.message, status: error.status };
  }
  if (error instanceof InvoiceHttpError) {
    return { message: error.message, status: error.status };
  }
  throw error;
}
