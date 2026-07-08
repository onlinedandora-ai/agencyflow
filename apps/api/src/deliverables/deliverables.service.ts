import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliverableStatus, DeliverableType, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ClientDeliverableFeedbackDto,
  CreateDeliverableDto,
  ReviewDeliverableDto,
} from './dto/deliverable.dto';

const MAX_FILE_BYTES = 2_000_000;
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';

@Injectable()
export class DeliverablesService {
  constructor(private readonly prisma: PrismaService) {}

  private isManager(role: string) {
    return role === UserRole.ADMIN || role === UserRole.CLIENT_MANAGER;
  }

  private format(
    d: {
      id: string;
      type: DeliverableType;
      label: string | null;
      url: string | null;
      fileName: string | null;
      mimeType: string | null;
      fileDataUrl?: string | null;
      version: number;
      status: DeliverableStatus;
      submittedAt: Date | null;
      reviewedAt: Date | null;
      reviewNote: string | null;
      sharedAt: Date | null;
      publicToken: string | null;
      clientApprovedAt: Date | null;
      clientFeedback: string | null;
      createdAt: Date;
      submittedBy?: { id: string; name: string } | null;
      reviewedBy?: { id: string; name: string } | null;
      sharedBy?: { id: string; name: string } | null;
      task?: {
        id: string;
        title: string;
        project?: {
          name: string;
          workspace?: { name: string; company: string | null };
        };
      };
    },
    opts?: { includeFile?: boolean },
  ) {
    const { fileDataUrl, ...rest } = d;
    return {
      ...rest,
      ...(opts?.includeFile && fileDataUrl ? { fileDataUrl } : {}),
      submittedAt: d.submittedAt?.toISOString() ?? null,
      reviewedAt: d.reviewedAt?.toISOString() ?? null,
      sharedAt: d.sharedAt?.toISOString() ?? null,
      clientApprovedAt: d.clientApprovedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      publicUrl: d.publicToken ? `${WEB_ORIGIN}/d/${d.publicToken}` : null,
      hasFile: !!d.fileName,
    };
  }

  private deliverableInclude = {
    submittedBy: { select: { id: true, name: true } },
    reviewedBy: { select: { id: true, name: true } },
    sharedBy: { select: { id: true, name: true } },
  };

  private validateCreate(dto: CreateDeliverableDto) {
    if (dto.type === DeliverableType.LINK) {
      if (!dto.url?.trim()) throw new BadRequestException('External link URL is required');
      if (!/^https?:\/\//i.test(dto.url.trim())) {
        throw new BadRequestException('Link must start with http:// or https://');
      }
      return;
    }
    if (!dto.fileDataUrl?.trim()) {
      throw new BadRequestException('Document file is required');
    }
    if (!dto.fileDataUrl.startsWith('data:')) {
      throw new BadRequestException('Invalid document upload');
    }
    if (dto.fileDataUrl.length > MAX_FILE_BYTES) {
      throw new BadRequestException('Document is too large (max ~2 MB)');
    }
  }

  private async getTaskForActor(taskId: string, userId: string, role: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { include: { workspace: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (!this.isManager(role) && task.assigneeId !== userId) {
      throw new ForbiddenException('Only the assignee or a manager can manage deliverables on this task');
    }
    return task;
  }

  async listForTask(taskId: string) {
    const items = await this.prisma.taskDeliverable.findMany({
      where: { taskId },
      include: this.deliverableInclude,
      orderBy: { createdAt: 'asc' },
    });
    return items.map((d) => this.format(d));
  }

  async create(taskId: string, dto: CreateDeliverableDto, userId: string, role: string) {
    await this.getTaskForActor(taskId, userId, role);
    this.validateCreate(dto);

    const created = await this.prisma.taskDeliverable.create({
      data: {
        taskId,
        type: dto.type,
        label: dto.label?.trim() || (dto.type === DeliverableType.LINK ? 'External link' : dto.fileName || 'Document'),
        url: dto.type === DeliverableType.LINK ? dto.url?.trim() : null,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileDataUrl: dto.type === DeliverableType.DOCUMENT ? dto.fileDataUrl : null,
      },
      include: this.deliverableInclude,
    });
    return this.format(created);
  }

  async submit(taskId: string, deliverableId: string, userId: string, role: string) {
    await this.getTaskForActor(taskId, userId, role);
    const item = await this.prisma.taskDeliverable.findFirst({
      where: { id: deliverableId, taskId },
    });
    if (!item) throw new NotFoundException('Deliverable not found');
    if (item.status !== DeliverableStatus.DRAFT && item.status !== DeliverableStatus.REJECTED) {
      throw new BadRequestException('Only draft or rejected deliverables can be submitted');
    }

    const updated = await this.prisma.taskDeliverable.update({
      where: { id: deliverableId },
      data: {
        status: DeliverableStatus.PENDING_REVIEW,
        submittedAt: new Date(),
        submittedById: userId,
        reviewNote: null,
        reviewedAt: null,
        reviewedById: null,
      },
      include: this.deliverableInclude,
    });
    return this.format(updated);
  }

  private requireManager(role: string) {
    if (!this.isManager(role)) {
      throw new ForbiddenException('Only managers can perform this action');
    }
  }

  async approve(taskId: string, deliverableId: string, userId: string, role: string, dto: ReviewDeliverableDto) {
    this.requireManager(role);
    const item = await this.prisma.taskDeliverable.findFirst({
      where: { id: deliverableId, taskId },
    });
    if (!item) throw new NotFoundException('Deliverable not found');
    if (item.status !== DeliverableStatus.PENDING_REVIEW) {
      throw new BadRequestException('Deliverable is not pending review');
    }

    const updated = await this.prisma.taskDeliverable.update({
      where: { id: deliverableId },
      data: {
        status: DeliverableStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedById: userId,
        reviewNote: dto.reviewNote,
      },
      include: this.deliverableInclude,
    });
    return this.format(updated);
  }

  async reject(taskId: string, deliverableId: string, userId: string, role: string, dto: ReviewDeliverableDto) {
    this.requireManager(role);
    if (!dto.reviewNote?.trim()) {
      throw new BadRequestException('Please provide feedback when rejecting');
    }
    const item = await this.prisma.taskDeliverable.findFirst({
      where: { id: deliverableId, taskId },
    });
    if (!item) throw new NotFoundException('Deliverable not found');
    if (item.status !== DeliverableStatus.PENDING_REVIEW) {
      throw new BadRequestException('Deliverable is not pending review');
    }

    const updated = await this.prisma.taskDeliverable.update({
      where: { id: deliverableId },
      data: {
        status: DeliverableStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: userId,
        reviewNote: dto.reviewNote,
      },
      include: this.deliverableInclude,
    });
    return this.format(updated);
  }

  async share(taskId: string, deliverableId: string, userId: string, role: string) {
    this.requireManager(role);
    const item = await this.prisma.taskDeliverable.findFirst({
      where: { id: deliverableId, taskId },
    });
    if (!item) throw new NotFoundException('Deliverable not found');
    if (item.status !== DeliverableStatus.APPROVED && item.status !== DeliverableStatus.SHARED) {
      throw new BadRequestException('Only approved deliverables can be shared with the client');
    }

    const token = item.publicToken ?? randomBytes(18).toString('hex');
    const updated = await this.prisma.taskDeliverable.update({
      where: { id: deliverableId },
      data: {
        status: DeliverableStatus.SHARED,
        sharedAt: new Date(),
        sharedById: userId,
        publicToken: token,
      },
      include: {
        ...this.deliverableInclude,
        task: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                name: true,
                workspace: { select: { name: true, company: true, email: true } },
              },
            },
          },
        },
      },
    });

    const formatted = this.format(updated);
    const workspace = updated.task?.project?.workspace;
    const clientName = workspace?.company || workspace?.name || 'Client';
    const message = `Hi ${clientName}, your deliverable "${updated.label}" for ${updated.task?.title} is ready for review: ${formatted.publicUrl}`;
    const mailto = workspace?.email
      ? `mailto:${encodeURIComponent(workspace.email)}?subject=${encodeURIComponent(`Deliverable ready — ${updated.task?.title}`)}&body=${encodeURIComponent(message)}`
      : null;
    const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`;

    return { deliverable: formatted, message, mailto, whatsapp, publicUrl: formatted.publicUrl };
  }

  async listPendingReview() {
    const items = await this.prisma.taskDeliverable.findMany({
      where: { status: DeliverableStatus.PENDING_REVIEW },
      include: {
        ...this.deliverableInclude,
        task: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                id: true,
                name: true,
                workspace: { select: { name: true, company: true } },
              },
            },
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });
    return items.map((d) => this.format(d));
  }

  async listSharedForWorkspace(billingToken: string) {
    const workspace = await this.prisma.clientWorkspace.findUnique({
      where: { billingToken },
    });
    if (!workspace) throw new NotFoundException('Portal not found');

    const items = await this.prisma.taskDeliverable.findMany({
      where: {
        status: { in: [DeliverableStatus.SHARED, DeliverableStatus.CLIENT_APPROVED] },
        task: { project: { workspaceId: workspace.id } },
      },
      include: {
        task: { select: { id: true, title: true, project: { select: { name: true } } } },
      },
      orderBy: { sharedAt: 'desc' },
    });
    return items.map((d) => this.format(d));
  }

  async getPublic(token: string) {
    const item = await this.prisma.taskDeliverable.findUnique({
      where: { publicToken: token },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                name: true,
                workspace: { select: { name: true, company: true } },
              },
            },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Deliverable not found');
    if (
      item.status !== DeliverableStatus.SHARED &&
      item.status !== DeliverableStatus.CLIENT_APPROVED
    ) {
      throw new NotFoundException('Deliverable is not available');
    }
    return this.format(item, { includeFile: true });
  }

  async clientFeedback(token: string, dto: ClientDeliverableFeedbackDto) {
    const item = await this.prisma.taskDeliverable.findUnique({ where: { publicToken: token } });
    if (!item) throw new NotFoundException('Deliverable not found');
    if (item.status !== DeliverableStatus.SHARED) {
      throw new BadRequestException('Feedback already recorded');
    }

    const updated = await this.prisma.taskDeliverable.update({
      where: { id: item.id },
      data: dto.approved
        ? {
            status: DeliverableStatus.CLIENT_APPROVED,
            clientApprovedAt: new Date(),
            clientFeedback: dto.feedback || 'Approved',
          }
        : {
            clientFeedback: dto.feedback,
            status: DeliverableStatus.REJECTED,
            reviewNote: `Client feedback: ${dto.feedback}`,
          },
      include: this.deliverableInclude,
    });
    return { message: dto.approved ? 'Thank you — approval recorded.' : 'Feedback sent to the team.', deliverable: this.format(updated) };
  }

  async hasApprovedDeliverable(taskId: string) {
    const count = await this.prisma.taskDeliverable.count({
      where: {
        taskId,
        status: { in: [DeliverableStatus.APPROVED, DeliverableStatus.SHARED, DeliverableStatus.CLIENT_APPROVED] },
      },
    });
    return count > 0;
  }
}
