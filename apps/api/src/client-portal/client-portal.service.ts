import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InvoiceDocumentType,
  InvoiceStatus,
  PaymentClaimStatus,
  PaymentMode,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import {
  DEFAULT_ACCESS_INTAKE,
  DEFAULT_BRAND_INTAKE,
  DEFAULT_ONBOARDING_INTAKE,
  IntakeSection,
  mergeIntake,
} from './intake-defaults';
import { ReviewPaymentClaimDto, SubmitPaymentClaimDto } from './dto/client-portal.dto';
import { RazorpayService } from '../payments/razorpay.service';

const MAX_PROOF_BYTES = 1_500_000;

@Injectable()
export class ClientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly razorpayService: RazorpayService,
  ) {}

  private async workspaceByToken(token: string) {
    const workspace = await this.prisma.clientWorkspace.findUnique({
      where: { billingToken: token },
    });
    if (!workspace) throw new NotFoundException('Client portal link not found');
    return workspace;
  }

  async getPortal(token: string) {
    const workspace = await this.workspaceByToken(token);
    const billing = await this.invoicesService.getBillingPortal(token);

    const claims = await this.prisma.paymentClaim.findMany({
      where: {
        invoice: { workspaceId: workspace.id },
      },
      include: {
        invoice: { select: { number: true } },
        milestone: { select: { label: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const payableInvoices = billing.taxInvoice
      ? [
          {
            id: billing.taxInvoice.id,
            number: billing.taxInvoice.number,
            amountDue: billing.taxInvoice.amountDue ?? Number(billing.taxInvoice.amount),
            status: billing.taxInvoice.status,
            milestones: billing.milestones.filter((m) => m.status === 'PENDING'),
          },
        ]
      : [];

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        company: workspace.company,
        billingFlow: workspace.billingFlow,
      },
      agency: billing.agency,
      intake: {
        onboarding: mergeIntake(DEFAULT_ONBOARDING_INTAKE, workspace.onboardingIntake),
        brand: mergeIntake(DEFAULT_BRAND_INTAKE, workspace.brandIntake),
        access: mergeIntake(DEFAULT_ACCESS_INTAKE, workspace.accessIntake),
        submitted: {
          onboarding: !!workspace.onboardingIntakeAt,
          brand: !!workspace.brandIntakeAt,
          access: !!workspace.accessIntakeAt,
        },
        submittedAt: {
          onboarding: workspace.onboardingIntakeAt,
          brand: workspace.brandIntakeAt,
          access: workspace.accessIntakeAt,
        },
      },
      billing,
      payableInvoices,
      razorpay: this.razorpayService.getPublicConfig(),
      paymentClaims: claims.map((c) => ({
        id: c.id,
        invoiceNumber: c.invoice.number,
        milestoneLabel: c.milestone?.label ?? null,
        amount: Number(c.amount),
        paymentMode: c.paymentMode,
        paymentReference: c.paymentReference,
        status: c.status,
        submittedAt: c.submittedAt,
        submittedByName: c.submittedByName,
        reviewNote: c.reviewNote,
      })),
      steps: [
        { key: 'onboarding', label: 'Client onboarding', done: !!workspace.onboardingIntakeAt },
        { key: 'brand', label: 'Brand & assets', done: !!workspace.brandIntakeAt },
        { key: 'access', label: 'Access & social', done: !!workspace.accessIntakeAt },
        { key: 'billing', label: 'Billing & payment', done: billing.taxInvoice?.status === 'PAID' },
      ],
    };
  }

  async saveIntake(token: string, section: IntakeSection, data: Record<string, unknown>) {
    const workspace = await this.workspaceByToken(token);
    const fieldMap = {
      onboarding: 'onboardingIntake' as const,
      brand: 'brandIntake' as const,
      access: 'accessIntake' as const,
    };

    return this.prisma.clientWorkspace.update({
      where: { id: workspace.id },
      data: { [fieldMap[section]]: data },
    });
  }

  async submitIntake(token: string, section: IntakeSection, data: Record<string, unknown>) {
    const workspace = await this.workspaceByToken(token);
    const atFieldMap = {
      onboarding: 'onboardingIntakeAt' as const,
      brand: 'brandIntakeAt' as const,
      access: 'accessIntakeAt' as const,
    };
    const dataFieldMap = {
      onboarding: 'onboardingIntake' as const,
      brand: 'brandIntake' as const,
      access: 'accessIntake' as const,
    };

    const updated = await this.prisma.clientWorkspace.update({
      where: { id: workspace.id },
      data: {
        [dataFieldMap[section]]: data,
        [atFieldMap[section]]: new Date(),
      },
    });

    return {
      message: `${section} intake submitted`,
      submittedAt: updated[atFieldMap[section]],
    };
  }

  private validateProof(proofDataUrl?: string) {
    if (!proofDataUrl) {
      throw new BadRequestException('Payment screenshot is required');
    }
    if (!proofDataUrl.startsWith('data:image/')) {
      throw new BadRequestException('Payment proof must be an image file');
    }
    if (proofDataUrl.length > MAX_PROOF_BYTES) {
      throw new BadRequestException('Payment screenshot is too large (max ~1 MB)');
    }
  }

  async submitPaymentClaim(token: string, dto: SubmitPaymentClaimDto) {
    const workspace = await this.workspaceByToken(token);
    this.validateProof(dto.proofDataUrl);

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: dto.invoiceId,
        workspaceId: workspace.id,
        documentType: InvoiceDocumentType.TAX,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      include: { paymentMilestones: true },
    });
    if (!invoice) {
      throw new BadRequestException('No payable invoice found for this payment');
    }

    const existingPending = await this.prisma.paymentClaim.findFirst({
      where: {
        invoiceId: invoice.id,
        milestoneId: dto.milestoneId ?? null,
        status: PaymentClaimStatus.PENDING,
      },
    });
    if (existingPending) {
      throw new BadRequestException('A payment confirmation is already pending review for this invoice');
    }

    if (dto.milestoneId) {
      const milestone = invoice.paymentMilestones.find((m) => m.id === dto.milestoneId);
      if (!milestone) throw new NotFoundException('Milestone not found');
      if (milestone.status === 'PAID') {
        throw new BadRequestException('This milestone is already paid');
      }
    }

    const claim = await this.prisma.paymentClaim.create({
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
      message: 'Payment submitted for review. We will validate and share your receipt shortly.',
      claimId: claim.id,
    };
  }

  async listPaymentClaims(status?: PaymentClaimStatus) {
    return this.prisma.paymentClaim.findMany({
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
      orderBy: { submittedAt: 'desc' },
    });
  }

  async getPaymentClaim(id: string) {
    const claim = await this.prisma.paymentClaim.findUnique({
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
    if (!claim) throw new NotFoundException('Payment claim not found');
    return claim;
  }

  async approvePaymentClaim(id: string, actorId: string, dto: ReviewPaymentClaimDto) {
    const claim = await this.getPaymentClaim(id);
    if (claim.status !== PaymentClaimStatus.PENDING) {
      throw new BadRequestException('Claim is not pending');
    }

    const result = await this.invoicesService.recordPayment(
      claim.invoice.id,
      {
        paymentMode: claim.paymentMode as PaymentMode,
        amount: Number(claim.amount),
        paymentReference: claim.paymentReference ?? `Client claim ${claim.id.slice(-6)}`,
        milestoneId: claim.milestone?.id,
      },
      actorId,
    );

    await this.prisma.paymentClaim.update({
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
      message: 'Payment validated — receipt issued to client.',
    };
  }

  async rejectPaymentClaim(id: string, actorId: string, dto: ReviewPaymentClaimDto) {
    const claim = await this.getPaymentClaim(id);
    if (claim.status !== PaymentClaimStatus.PENDING) {
      throw new BadRequestException('Claim is not pending');
    }
    if (!dto.reviewNote?.trim()) {
      throw new BadRequestException('Please provide a reason for rejection');
    }

    await this.prisma.paymentClaim.update({
      where: { id },
      data: {
        status: PaymentClaimStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: actorId,
        reviewNote: dto.reviewNote,
      },
    });

    return { message: 'Payment claim rejected — client can resubmit with corrected proof.' };
  }
}
