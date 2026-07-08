import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  InvoiceDocumentType,
  InvoiceStatus,
  PaymentMode,
  RazorpayOrderStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { CreateRazorpayOrderDto, VerifyRazorpayPaymentDto } from './dto/razorpay.dto';

@Injectable()
export class RazorpayService {
  private client: Razorpay | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (keyId && keySecret) {
      this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    }
  }

  isConfigured() {
    return !!this.client;
  }

  getPublicConfig() {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    if (!keyId || !this.client) return { enabled: false as const };
    return { enabled: true as const, keyId };
  }

  private requireClient() {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Online payments are not configured. Use bank transfer instead.',
      );
    }
    return this.client;
  }

  private async workspaceByToken(token: string) {
    const workspace = await this.prisma.clientWorkspace.findUnique({
      where: { billingToken: token },
    });
    if (!workspace) throw new NotFoundException('Client portal link not found');
    return workspace;
  }

  private async resolvePayableAmount(
    invoiceId: string,
    workspaceId: string,
    milestoneId?: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        workspaceId,
        documentType: InvoiceDocumentType.TAX,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      include: {
        receipts: true,
        paymentMilestones: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!invoice) {
      throw new BadRequestException('No payable invoice found');
    }

    const totalAmount = Number(invoice.amount);
    const alreadyPaid = invoice.receipts.reduce((sum, r) => sum + Number(r.amount), 0);
    const remaining = totalAmount - alreadyPaid;
    if (remaining <= 0) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    if (milestoneId) {
      const milestone = invoice.paymentMilestones.find((m) => m.id === milestoneId);
      if (!milestone) throw new NotFoundException('Milestone not found');
      if (milestone.status === 'PAID') {
        throw new BadRequestException('This milestone is already paid');
      }
      return { invoice, amount: Number(milestone.amount), milestone };
    }

    const pendingMilestones = invoice.paymentMilestones.filter((m) => m.status === 'PENDING');
    if (pendingMilestones.length > 0) {
      throw new BadRequestException('Select which payment milestone to pay');
    }

    return { invoice, amount: remaining, milestone: undefined };
  }

  async createOrder(token: string, dto: CreateRazorpayOrderDto) {
    const client = this.requireClient();
    const workspace = await this.workspaceByToken(token);
    const { invoice, amount, milestone } = await this.resolvePayableAmount(
      dto.invoiceId,
      workspace.id,
      dto.milestoneId,
    );

    const amountPaise = Math.round(amount * 100);
    if (amountPaise < 100) {
      throw new BadRequestException('Payment amount must be at least ₹1');
    }

    const receipt = `${invoice.number}-${Date.now()}`.slice(0, 40);
    const order = await client.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        workspaceId: workspace.id,
        milestoneId: milestone?.id ?? '',
      },
    });

    const record = await this.prisma.razorpayOrder.create({
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
      currency: 'INR',
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

  verifySignature(orderId: string, paymentId: string, signature: string) {
    const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!secret) return false;
    const body = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return expected === signature;
  }

  async verifyPayment(token: string, dto: VerifyRazorpayPaymentDto) {
    const workspace = await this.workspaceByToken(token);

    if (!this.verifySignature(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature)) {
      throw new BadRequestException('Payment verification failed — invalid signature');
    }

    const order = await this.prisma.razorpayOrder.findUnique({
      where: { razorpayOrderId: dto.razorpay_order_id },
      include: { invoice: true, milestone: true },
    });
    if (!order) throw new NotFoundException('Payment order not found');
    if (order.invoice.workspaceId !== workspace.id) {
      throw new BadRequestException('Payment does not belong to this workspace');
    }
    if (order.status === RazorpayOrderStatus.PAID) {
      return {
        message: 'Payment already recorded',
        alreadyPaid: true,
      };
    }

    const duplicate = await this.prisma.invoice.findFirst({
      where: { paymentReference: dto.razorpay_payment_id },
    });
    if (duplicate) {
      await this.prisma.razorpayOrder.update({
        where: { id: order.id },
        data: {
          status: RazorpayOrderStatus.PAID,
          paymentId: dto.razorpay_payment_id,
          paidAt: new Date(),
        },
      });
      return { message: 'Payment already recorded', alreadyPaid: true };
    }

    const result = await this.invoicesService.recordPayment(
      order.invoiceId,
      {
        paymentMode: PaymentMode.ONLINE,
        amount: Number(order.amount),
        paymentReference: dto.razorpay_payment_id,
        milestoneId: order.milestoneId ?? undefined,
      },
    );

    await this.prisma.razorpayOrder.update({
      where: { id: order.id },
      data: {
        status: RazorpayOrderStatus.PAID,
        paymentId: dto.razorpay_payment_id,
        paidAt: new Date(),
      },
    });

    return {
      ...result,
      message: 'Payment successful — receipt generated.',
      alreadyPaid: false,
    };
  }
}
