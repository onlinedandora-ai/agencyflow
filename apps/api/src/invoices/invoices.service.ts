import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingFlow,
  InvoiceDocumentType,
  InvoiceStatus,
  MilestoneStatus,
  PaymentMode,
  ProjectStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  IssueTaxInvoiceDto,
  RecordPaymentDto,
  RequestTaxInvoiceDto,
  SendMilestoneNotificationDto,
  SetMilestonesDto,
} from './dto/invoice.dto';
import { MILESTONE_TEMPLATES, splitsFromTemplate } from '../common/milestone-templates';

const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  private invoiceInclude = {
    workspace: true,
    project: true,
    proposal: { include: { lead: true } },
    relatedInvoice: true,
    receipts: { orderBy: { paidAt: 'asc' as const } },
    paymentMilestones: {
      orderBy: { sortOrder: 'asc' as const },
      include: {
        receipt: { select: { id: true, number: true, paidAt: true } },
        notifications: {
          orderBy: { sentAt: 'desc' as const },
          include: { sentBy: { select: { id: true, name: true } } },
        },
      },
    },
  };

  private formatNumber(prefix: string, seq: number) {
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
  }

  private async nextNumber(type: InvoiceDocumentType) {
    const profile = await this.settingsService.getAgencyProfile();
    if (type === InvoiceDocumentType.DRAFT) {
      const number = this.formatNumber(profile.draftInvoicePrefix, profile.draftInvoiceNextSeq);
      await this.prisma.agencyProfile.update({
        where: { id: 'default' },
        data: { draftInvoiceNextSeq: profile.draftInvoiceNextSeq + 1 },
      });
      return number;
    }
    if (type === InvoiceDocumentType.RECEIPT) {
      const number = this.formatNumber(profile.receiptPrefix, profile.receiptNextSeq);
      await this.prisma.agencyProfile.update({
        where: { id: 'default' },
        data: { receiptNextSeq: profile.receiptNextSeq + 1 },
      });
      return number;
    }
    const number = this.formatNumber(profile.taxInvoicePrefix, profile.taxInvoiceNextSeq);
    await this.prisma.agencyProfile.update({
      where: { id: 'default' },
      data: { taxInvoiceNextSeq: profile.taxInvoiceNextSeq + 1 },
    });
    return number;
  }

  private parseAmount(investment?: string | null) {
    if (!investment) return 50000;
    return parseFloat(investment.replace(/[^\d.]/g, '')) || 50000;
  }

  private lineItemsFromProposal(proposal: {
    deliverables?: string | null;
    investment?: string | null;
  }) {
    const amount = this.parseAmount(proposal.investment);
    return [
      {
        description: proposal.deliverables?.split('\n')[0] || 'Project services as per proposal',
        amount,
      },
    ];
  }

  async getMilestoneTemplates() {
    return MILESTONE_TEMPLATES;
  }

  async setMilestones(invoiceId: string, dto: SetMilestonesDto, actorId?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { paymentMilestones: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.documentType !== InvoiceDocumentType.TAX) {
      throw new BadRequestException('Milestones can only be set on tax invoices');
    }

    const paidMilestones = invoice.paymentMilestones.filter((m) => m.status === MilestoneStatus.PAID);
    if (paidMilestones.length > 0) {
      throw new BadRequestException('Cannot change milestones after payments have been recorded');
    }

    const totalAmount = Number(invoice.amount);
    let items = dto.milestones;

    if (dto.templateKey) {
      const fromTemplate = splitsFromTemplate(dto.templateKey, totalAmount);
      if (!fromTemplate) throw new BadRequestException('Unknown milestone template');
      items = fromTemplate;
    }

    if (!items?.length) {
      throw new BadRequestException('Provide a template or custom milestones');
    }

    const sum = items.reduce((acc, m) => acc + m.amount, 0);
    if (Math.abs(sum - totalAmount) > 1) {
      throw new BadRequestException(
        `Milestone amounts must total ₹${totalAmount} (currently ₹${sum})`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
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

    await this.prisma.auditLog.create({
      data: {
        actorId,
        entityType: 'Invoice',
        entityId: invoiceId,
        action: 'MILESTONES_SET',
        metadata: { templateKey: dto.templateKey, count: items.length },
      },
    });

    return this.findOne(invoiceId);
  }

  async sendMilestoneNotification(
    milestoneId: string,
    dto: SendMilestoneNotificationDto = {},
    actorId?: string,
  ) {
    const milestone = await this.prisma.paymentMilestone.findUnique({
      where: { id: milestoneId },
      include: {
        invoice: {
          include: {
            workspace: true,
            proposal: { include: { lead: true } },
          },
        },
        notifications: { orderBy: { sentAt: 'desc' }, take: 3 },
      },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.status === MilestoneStatus.PAID) {
      throw new BadRequestException('Cannot notify for a paid milestone');
    }

    const invoice = milestone.invoice;
    const workspace = invoice.workspace;
    const agency = await this.settingsService.getAgencyProfile();
    const clientName = workspace.name;
    const clientEmail = workspace.email || invoice.proposal?.lead?.email;
    const billingUrl = workspace.billingToken
      ? `${WEB_ORIGIN}/billing/${workspace.billingToken}`
      : null;
    const amount = Number(milestone.amount).toLocaleString('en-IN');
    const dueLine = milestone.dueDate
      ? `Due by ${milestone.dueDate.toLocaleDateString('en-IN')}.`
      : 'Please arrange payment at your earliest convenience.';

    const message =
      `Hi ${clientName},\n\n` +
      `This is a payment reminder for *${milestone.label}* on invoice ${invoice.number}.\n\n` +
      `Amount due: ₹${amount}\n${dueLine}\n\n` +
      `View invoice and bank details: ${billingUrl || 'contact us for payment details'}\n\n` +
      `Thank you,\n${agency.name}`;

    const notification = await this.prisma.paymentMilestoneNotification.create({
      data: {
        milestoneId,
        sentById: actorId,
        message,
        internalNote: dto.internalNote,
      },
      include: { sentBy: { select: { id: true, name: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        entityType: 'PaymentMilestone',
        entityId: milestoneId,
        action: 'PAYMENT_NOTIFICATION_SENT',
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
      message: 'Payment notification logged. Share via WhatsApp or email below.',
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

  async getNumberingSettings() {
    const profile = await this.settingsService.getAgencyProfile();
    return {
      draftInvoicePrefix: profile.draftInvoicePrefix,
      draftInvoiceNextSeq: profile.draftInvoiceNextSeq,
      taxInvoicePrefix: profile.taxInvoicePrefix,
      taxInvoiceNextSeq: profile.taxInvoiceNextSeq,
      receiptPrefix: profile.receiptPrefix,
      receiptNextSeq: profile.receiptNextSeq,
    };
  }

  async updateNumberingSettings(dto: {
    draftInvoicePrefix?: string;
    draftInvoiceNextSeq?: number;
    taxInvoicePrefix?: string;
    taxInvoiceNextSeq?: number;
    receiptPrefix?: string;
    receiptNextSeq?: number;
  }) {
    return this.prisma.agencyProfile.update({
      where: { id: 'default' },
      data: dto,
    });
  }

  async findAll(filters?: { documentType?: InvoiceDocumentType; status?: InvoiceStatus }) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        documentType: filters?.documentType,
        status: filters?.status,
      },
      include: this.invoiceInclude,
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map((inv) => this.withMeta(inv));
  }

  private withMeta<
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
      ? `${WEB_ORIGIN}/billing/${invoice.workspace.billingToken}`
      : null;
    const publicUrl = invoice.publicToken
      ? `${WEB_ORIGIN}/billing/doc/${invoice.publicToken}`
      : null;

    const totalAmount = Number(invoice.amount);
    const amountPaid =
      invoice.receipts?.reduce((sum, r) => sum + Number(r.amount), 0) ?? 0;
    const amountDue = Math.max(0, totalAmount - amountPaid);

    return {
      ...invoice,
      billingUrl,
      publicUrl,
      amountPaid,
      amountDue,
      typeLabel:
        invoice.documentType === InvoiceDocumentType.DRAFT
          ? 'Draft invoice'
          : invoice.documentType === InvoiceDocumentType.RECEIPT
            ? 'Payment receipt'
            : invoice.status === InvoiceStatus.REQUESTED
              ? 'Tax invoice requested'
              : 'Tax invoice',
    };
  }

  private paidTotal(receipts: { amount: { toString(): string } | number }[]) {
    return receipts.reduce((sum, r) => sum + Number(r.amount), 0);
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: this.invoiceInclude,
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.withMeta(invoice);
  }

  async getBillingPortal(token: string) {
    const workspace = await this.prisma.clientWorkspace.findUnique({
      where: { billingToken: token },
      include: {
        invoices: {
          include: { receipts: true, relatedInvoice: true },
          orderBy: { createdAt: 'asc' },
        },
        projects: true,
      },
    });
    if (!workspace) throw new NotFoundException('Billing link not found');

    const agency = await this.settingsService.getAgencyProfile();
    const proposal = workspace.leadId
      ? await this.prisma.proposal.findUnique({
          where: { leadId: workspace.leadId },
          include: { lead: true },
        })
      : null;

    const draftInvoice = workspace.invoices.find((i) => i.documentType === InvoiceDocumentType.DRAFT);
    const taxInvoices = workspace.invoices.filter((i) => i.documentType === InvoiceDocumentType.TAX);
    const receipts = workspace.invoices.filter((i) => i.documentType === InvoiceDocumentType.RECEIPT);

    const pendingTaxRequest = taxInvoices.find((i) => i.status === InvoiceStatus.REQUESTED);
    const activeTaxInvoice = taxInvoices.find(
      (i) =>
        i.status === InvoiceStatus.SENT ||
        i.status === InvoiceStatus.PARTIALLY_PAID ||
        i.status === InvoiceStatus.PAID ||
        i.status === InvoiceStatus.OVERDUE,
    );

    const taxInvoiceDetail = activeTaxInvoice ? await this.findOne(activeTaxInvoice.id) : null;

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
      draftInvoice: draftInvoice ? this.withMeta({ ...draftInvoice, workspace }) : null,
      taxInvoice: taxInvoiceDetail,
      pendingTaxRequest: pendingTaxRequest ? this.withMeta({ ...pendingTaxRequest, workspace }) : null,
      receipts: receipts.map((r) => this.withMeta({ ...r, workspace })),
      steps: this.buildSteps(workspace.billingFlow, draftInvoice, activeTaxInvoice, receipts),
      milestones: taxInvoiceDetail?.paymentMilestones ?? [],
    };
  }

  private buildSteps(
    billingFlow: BillingFlow,
    draft: { status: InvoiceStatus } | undefined,
    tax: { status: InvoiceStatus; paidAt: Date | null } | undefined,
    receipts: { id: string }[],
  ) {
    if (billingFlow === BillingFlow.DIRECT) {
      return [
        { key: 'proposal', label: 'Proposal accepted', done: true },
        { key: 'invoice', label: 'Advance invoice', done: !!tax, active: !tax },
        { key: 'paid', label: 'Payment received', done: tax?.status === InvoiceStatus.PAID, active: tax?.status === InvoiceStatus.SENT },
      ];
    }
    return [
      { key: 'proposal', label: 'Proposal accepted', done: true },
      { key: 'draft', label: 'Draft invoice', done: !!draft, active: !draft },
      { key: 'tax_request', label: 'Tax invoice requested', done: !!tax || draft?.status === InvoiceStatus.REQUESTED, active: !!draft && !tax },
      { key: 'tax', label: 'Tax invoice issued', done: tax?.status === InvoiceStatus.PAID || tax?.status === InvoiceStatus.SENT, active: tax?.status === InvoiceStatus.REQUESTED },
      { key: 'paid', label: 'Payment recorded', done: receipts.length > 0 || tax?.status === InvoiceStatus.PAID, active: tax?.status === InvoiceStatus.SENT },
    ];
  }

  async createOnAccept(params: {
    workspaceId: string;
    projectId: string;
    proposalId: string;
    billingFlow: BillingFlow;
    investment?: string | null;
    deliverables?: string | null;
    isAdvance?: boolean;
  }) {
    const amount = this.parseAmount(params.investment);
    const lineItems = this.lineItemsFromProposal({
      investment: params.investment,
      deliverables: params.deliverables,
    });

    const workspace = await this.prisma.clientWorkspace.update({
      where: { id: params.workspaceId },
      data: {
        billingFlow: params.billingFlow,
        billingToken: randomBytes(18).toString('hex'),
      },
    });

    if (params.billingFlow === BillingFlow.DRAFT_FIRST) {
      const number = await this.nextNumber(InvoiceDocumentType.DRAFT);
      return this.prisma.invoice.create({
        data: {
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          proposalId: params.proposalId,
          number,
          documentType: InvoiceDocumentType.DRAFT,
          amount,
          description: 'Draft invoice — for client review before tax invoice',
          lineItems,
          status: InvoiceStatus.SENT,
          sentAt: new Date(),
          publicToken: randomBytes(18).toString('hex'),
        },
        include: this.invoiceInclude,
      });
    }

    const number = await this.nextNumber(InvoiceDocumentType.TAX);
    return this.prisma.invoice.create({
      data: {
        workspaceId: params.workspaceId,
        projectId: params.projectId,
        proposalId: params.proposalId,
        number,
        documentType: InvoiceDocumentType.TAX,
        amount,
        description: params.isAdvance ? 'Tax invoice — payment per milestones' : 'Tax invoice',
        lineItems,
        status: InvoiceStatus.SENT,
        sentAt: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isAdvance: params.isAdvance ?? false,
        publicToken: randomBytes(18).toString('hex'),
      },
      include: this.invoiceInclude,
    });
  }

  async requestTaxInvoice(billingToken: string, dto: RequestTaxInvoiceDto) {
    const workspace = await this.prisma.clientWorkspace.findUnique({
      where: { billingToken },
      include: { invoices: true },
    });
    if (!workspace) throw new NotFoundException('Billing link not found');
    if (workspace.billingFlow !== BillingFlow.DRAFT_FIRST) {
      throw new BadRequestException('Tax invoice request is only for draft-first billing');
    }

    const draft = workspace.invoices.find((i) => i.documentType === InvoiceDocumentType.DRAFT);
    if (!draft) throw new BadRequestException('No draft invoice found');

    const existing = workspace.invoices.find(
      (i) =>
        i.documentType === InvoiceDocumentType.TAX &&
        i.status !== InvoiceStatus.CANCELLED,
    );
    if (existing) {
      throw new BadRequestException('Tax invoice already exists or requested');
    }

    const number = await this.nextNumber(InvoiceDocumentType.TAX);
    const taxInvoice = await this.prisma.invoice.create({
      data: {
        workspaceId: workspace.id,
        projectId: draft.projectId,
        proposalId: draft.proposalId,
        number,
        documentType: InvoiceDocumentType.TAX,
        amount: draft.amount,
        description: 'Tax invoice — requested by client',
        lineItems: draft.lineItems ?? undefined,
        status: InvoiceStatus.REQUESTED,
        requestedAt: new Date(),
        requestedByName: dto.requestedByName,
        requestedByEmail: dto.requestedByEmail,
        publicToken: randomBytes(18).toString('hex'),
      },
      include: this.invoiceInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'Invoice',
        entityId: taxInvoice.id,
        action: 'TAX_INVOICE_REQUESTED',
        metadata: { requestedByName: dto.requestedByName, workspaceId: workspace.id },
      },
    });

    return {
      message: 'Tax invoice request received. We will issue your tax invoice shortly.',
      taxInvoice: this.withMeta(taxInvoice),
    };
  }

  async issueTaxInvoice(invoiceId: string, dto: IssueTaxInvoiceDto = {}, actorId?: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.documentType !== InvoiceDocumentType.TAX) {
      throw new BadRequestException('Only tax invoices can be issued');
    }
    if (invoice.status !== InvoiceStatus.REQUESTED && invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Invoice is not in a state that can be issued');
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.SENT,
        sentAt: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        description: dto.internalNote
          ? `Tax invoice — ${dto.internalNote}`
          : invoice.description,
      },
      include: this.invoiceInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        entityType: 'Invoice',
        entityId: invoiceId,
        action: 'TAX_INVOICE_ISSUED',
        metadata: { number: updated.number },
      },
    });

    return this.withMeta(updated);
  }

  async recordPayment(invoiceId: string, dto: RecordPaymentDto, actorId?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        workspace: true,
        receipts: true,
        paymentMilestones: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.documentType === InvoiceDocumentType.RECEIPT) {
      throw new BadRequestException('Cannot record payment on a receipt');
    }
    if (invoice.documentType === InvoiceDocumentType.DRAFT) {
      throw new BadRequestException('Record payments against the tax invoice, not the draft');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is fully paid');
    }

    const milestones = invoice.paymentMilestones;
    const pendingMilestones = milestones.filter((m) => m.status === MilestoneStatus.PENDING);

    if (pendingMilestones.length > 0 && !dto.milestoneId) {
      throw new BadRequestException('Select which payment milestone this payment is for');
    }

    let milestone: (typeof milestones)[0] | undefined;
    if (dto.milestoneId) {
      milestone = milestones.find((m) => m.id === dto.milestoneId);
      if (!milestone) throw new NotFoundException('Milestone not found');
      if (milestone.status === MilestoneStatus.PAID) {
        throw new BadRequestException('This milestone is already paid');
      }
    }

    const totalAmount = Number(invoice.amount);
    const alreadyPaid = this.paidTotal(invoice.receipts);
    const remaining = totalAmount - alreadyPaid;
    if (remaining <= 0) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    const paymentAmount = milestone ? Number(milestone.amount) : (dto.amount ?? remaining);
    if (paymentAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }
    if (paymentAmount > remaining) {
      throw new BadRequestException(`Payment exceeds balance due (₹${remaining})`);
    }
    if (milestone && Math.abs(paymentAmount - Number(milestone.amount)) > 0.01) {
      throw new BadRequestException(`Payment must match milestone amount (₹${milestone.amount})`);
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const newPaidTotal = alreadyPaid + paymentAmount;
    const isFullyPaid = newPaidTotal >= totalAmount;
    const receiptLabel = milestone ? milestone.label : isFullyPaid ? 'Full payment' : 'Partial payment';

    const updated = await this.prisma.$transaction(async (tx) => {
      const profile = await this.settingsService.getAgencyProfile();
      const receiptNumber = this.formatNumber(profile.receiptPrefix, profile.receiptNextSeq);
      await tx.agencyProfile.update({
        where: { id: 'default' },
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
          publicToken: randomBytes(18).toString('hex'),
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
          entityType: 'Invoice',
          entityId: invoice.id,
          action: 'PAYMENT_RECORDED',
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

    const full = await this.findOne(updated.paid.id);
    return {
      invoice: full,
      receipt: await this.findOne(updated.receipt.id),
      message: isFullyPaid
        ? 'Payment recorded. Invoice fully paid — receipt generated.'
        : `Partial payment of ₹${paymentAmount} recorded. Receipt generated. ₹${totalAmount - newPaidTotal} remaining.`,
    };
  }

  async getPublicDocument(token: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { publicToken: token },
      include: this.invoiceInclude,
    });
    if (!invoice) throw new NotFoundException('Document not found');
    const agency = await this.settingsService.getAgencyProfile();
    return { invoice: this.withMeta(invoice), agency };
  }
}
