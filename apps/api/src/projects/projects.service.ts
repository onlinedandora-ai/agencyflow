import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import {
  columnIndex,
  getFirstColumnKey,
  getServiceLineTemplate,
  SERVICE_LINE_TEMPLATES,
  type BoardColumn,
} from '../common/service-line-templates';
import {
  isApprovedColumn,
  isClientReviewColumn,
  requiresBillableAcknowledgement,
} from '../common/delivery-gates';
import { normalizePriority } from '../common/task-priorities';
import { computeSlaDeadline, computeTaskSla } from '../common/task-sla';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, MoveTaskDto, UpdateTaskDto } from './dto/task.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private taskInclude = {
    assignee: { select: { id: true, name: true, email: true, role: true } },
    qaSignedOffBy: { select: { id: true, name: true, email: true, role: true } },
  };

  private projectInclude = {
    workspace: true,
    tasks: {
      include: this.taskInclude,
      orderBy: [{ boardColumn: 'asc' as const }, { sortOrder: 'asc' as const }],
    },
    invoices: true,
  };

  private formatTask(
    task: {
      id: string;
      title: string;
      description: string | null;
      status: string;
      boardColumn: string;
      sortOrder: number;
      priority: string | null;
      dueDate: Date | null;
      revisionRound: number;
      qaSignedOffAt: Date | null;
      qaSignedOffById: string | null;
      qaSignedOffBy?: { id: string; name: string; email: string; role?: string } | null;
      billableRevisionPending: boolean;
      clientApprovedAt: Date | null;
      isBlockedByGate: boolean;
      gateReason: string | null;
      customFields: unknown;
      createdAt: Date;
      updatedAt: Date;
      assignee?: { id: string; name: string; email: string; role?: string } | null;
    },
    serviceLine?: string,
  ) {
    const template = serviceLine ? getServiceLineTemplate(serviceLine) : null;
    const doneColumnKey = template?.columns[template.columns.length - 1]?.key;
    const sla = computeTaskSla(task, doneColumnKey);

    return {
      ...task,
      priority: normalizePriority(task.priority),
      customFields: (task.customFields as Record<string, string> | null) ?? null,
      dueDate: task.dueDate?.toISOString() ?? sla.deadline,
      qaSignedOffAt: task.qaSignedOffAt?.toISOString() ?? null,
      clientApprovedAt: task.clientApprovedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      sla,
    };
  }

  private computeProjectStats(
    tasks: Array<{
      boardColumn: string;
      dueDate: Date | null;
      status: string;
      priority?: string | null;
      createdAt?: Date;
    }>,
    serviceLine: string,
  ) {
    const template = getServiceLineTemplate(serviceLine);
    const doneColumn = template.columns[template.columns.length - 1]?.key;
    const now = new Date();
    const overdueCount = tasks.filter(
      (task) =>
        task.dueDate &&
        task.dueDate < now &&
        task.boardColumn !== doneColumn &&
        task.status !== 'APPROVED',
    ).length;
    const slaBreaches = tasks.filter((task) => {
      const sla = computeTaskSla(
        {
          priority: task.priority ?? 'MEDIUM',
          dueDate: task.dueDate,
          createdAt: task.createdAt ?? now,
          boardColumn: task.boardColumn,
          status: task.status,
        },
        doneColumn,
      );
      return sla.breached;
    }).length;
    const completedCount = tasks.filter((task) => task.boardColumn === doneColumn).length;
    const urgentCount = tasks.filter((task) => normalizePriority(task.priority as string) === 'URGENT').length;
    const progressPercent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
    const health =
      overdueCount > 0 || urgentCount > 2 ? 'red' : urgentCount > 0 || progressPercent < 40 ? 'yellow' : 'green';

    return { overdueCount, slaBreaches, completedCount, urgentCount, progressPercent, health };
  }

  getTemplates() {
    return Object.values(SERVICE_LINE_TEMPLATES);
  }

  async findAll() {
    const projects = await this.prisma.project.findMany({
      include: {
        workspace: true,
        tasks: {
          select: {
            id: true,
            boardColumn: true,
            status: true,
            dueDate: true,
            priority: true,
            createdAt: true,
            assigneeId: true,
            assignee: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map((project) => {
      const serviceLine = project.workspace.serviceLine || 'Content Creation';
      const stats = this.computeProjectStats(project.tasks, serviceLine);
      const assignees = [
        ...new Map(
          project.tasks
            .filter((task) => task.assignee)
            .map((task) => [task.assignee!.id, task.assignee!]),
        ).values(),
      ];

      return {
        ...project,
        serviceLine,
        taskCount: project.tasks.length,
        template: getServiceLineTemplate(project.workspace.serviceLine),
        isGateLocked: project.status === ProjectStatus.AWAITING_ADVANCE,
        ...stats,
        team: assignees,
      };
    });
  }

  async findOne(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: this.projectInclude,
    });
    if (!project) throw new NotFoundException('Project not found');

    const serviceLine = project.workspace.serviceLine || 'Content Creation';
    const template = getServiceLineTemplate(serviceLine);
    const isGateLocked = project.status === ProjectStatus.AWAITING_ADVANCE;

    return {
      ...project,
      serviceLine,
      template,
      isGateLocked,
      gateMessage: isGateLocked
        ? 'Advance payment required before tasks can move beyond the first column'
        : null,
      tasks: project.tasks.map((task) => this.formatTask(task, serviceLine)),
    };
  }

  async getTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        ...this.taskInclude,
        project: {
          include: {
            workspace: { select: { id: true, name: true, company: true, serviceLine: true } },
          },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');

    const serviceLine = task.project.workspace.serviceLine || 'Content Creation';
    const template = getServiceLineTemplate(serviceLine);
    const column = template.columns.find((col) => col.key === task.boardColumn);

    return {
      ...this.formatTask(task, serviceLine),
      columnLabel: column?.label ?? task.boardColumn,
      project: {
        id: task.project.id,
        name: task.project.name,
        status: task.project.status,
      },
      workspace: task.project.workspace,
      template: { customFieldLabels: template.customFieldLabels, columns: template.columns },
    };
  }

  async getBoard(projectId: string) {
    const project = await this.findOne(projectId);
    const columns = project.template.columns.map((col) => ({
      ...col,
      tasks: project.tasks
        .filter((task) => task.boardColumn === col.key)
        .map((task) => ({
          ...task,
          isBlockedByGate:
            project.isGateLocked && columnIndex(project.serviceLine, task.boardColumn) > 0,
        })),
    }));

    const stats = this.computeProjectStats(
      project.tasks.map((task) => ({
        boardColumn: task.boardColumn,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        status: task.status,
        priority: task.priority,
        createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
      })),
      project.serviceLine,
    );

    return {
      projectId: project.id,
      projectName: project.name,
      projectStatus: project.status,
      workspace: {
        id: project.workspace.id,
        name: project.workspace.name,
        company: project.workspace.company,
      },
      serviceLine: project.serviceLine,
      template: project.template,
      isGateLocked: project.isGateLocked,
      gateMessage: project.gateMessage,
      columns,
      ...stats,
    };
  }

  private async getProjectContext(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    const serviceLine = project.workspace.serviceLine || 'Content Creation';
    return { project, serviceLine };
  }

  private getColumn(serviceLine: string, columnKey: string): BoardColumn {
    const template = getServiceLineTemplate(serviceLine);
    const column = template.columns.find((col) => col.key === columnKey);
    if (!column) throw new BadRequestException('Invalid board column for this service line');
    return column;
  }

  private enforceDeliveryGates(
    task: {
      boardColumn: string;
      revisionRound: number;
      qaSignedOffAt: Date | null;
      billableRevisionPending: boolean;
      assigneeId: string | null;
    },
    serviceLine: string,
    fromColumn: BoardColumn,
    toColumn: BoardColumn,
  ) {
    const fromIdx = columnIndex(serviceLine, fromColumn.key);
    const toIdx = columnIndex(serviceLine, toColumn.key);

    if (isClientReviewColumn(toColumn)) {
      if (!task.qaSignedOffAt) {
        throw new BadRequestException(
          'Peer QA sign-off is required before moving a task to client review',
        );
      }
      if (task.billableRevisionPending) {
        throw new BadRequestException(
          'Revision round 3+ is billable — a manager must acknowledge before client review resumes',
        );
      }
    }

    if (isClientReviewColumn(fromColumn) && toIdx < fromIdx) {
      const nextRound = task.revisionRound + 1;
      if (requiresBillableAcknowledgement(nextRound)) {
        return {
          revisionRound: nextRound,
          billableRevisionPending: true,
          qaSignedOffAt: null,
          qaSignedOffById: null,
        };
      }
      return {
        revisionRound: nextRound,
        billableRevisionPending: task.billableRevisionPending,
        qaSignedOffAt: null,
        qaSignedOffById: null,
      };
    }

    return null;
  }

  async signOffQa(taskId: string, actorId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { include: { workspace: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');

    const serviceLine = task.project.workspace.serviceLine || 'Content Creation';
    const clientReviewIdx = getServiceLineTemplate(serviceLine).columns.findIndex((col) =>
      isClientReviewColumn(col),
    );

    if (clientReviewIdx < 0) {
      throw new BadRequestException('This service line has no client review stage');
    }

    const currentIdx = columnIndex(serviceLine, task.boardColumn);
    if (currentIdx >= clientReviewIdx) {
      throw new BadRequestException('QA sign-off must happen before client review');
    }

    if (task.assigneeId && task.assigneeId === actorId) {
      throw new BadRequestException('QA sign-off must be done by someone other than the assignee');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.task.update({
        where: { id: taskId },
        data: {
          qaSignedOffAt: new Date(),
          qaSignedOffById: actorId,
        },
        include: this.taskInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          entityType: 'task',
          entityId: taskId,
          action: 'qa_signoff',
          metadata: { boardColumn: task.boardColumn, serviceLine },
        },
      });

      return row;
    });

    return this.formatTask(updated, serviceLine);
  }

  async acknowledgeBillableRevision(taskId: string, actorId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { include: { workspace: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (!task.billableRevisionPending) {
      throw new BadRequestException('This task has no pending billable revision');
    }

    const serviceLine = task.project.workspace.serviceLine || 'Content Creation';

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.task.update({
        where: { id: taskId },
        data: { billableRevisionPending: false },
        include: this.taskInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          entityType: 'task',
          entityId: taskId,
          action: 'billable_revision_acknowledged',
          metadata: { revisionRound: task.revisionRound },
        },
      });

      return row;
    });

    return this.formatTask(updated, serviceLine);
  }

  private enforceGate(
    project: { status: ProjectStatus },
    serviceLine: string,
    targetColumn: string,
  ) {
    if (project.status !== ProjectStatus.AWAITING_ADVANCE) return;

    const targetIdx = columnIndex(serviceLine, targetColumn);
    if (targetIdx > 0) {
      throw new BadRequestException(
        'Advance payment must be confirmed before moving tasks beyond the first column',
      );
    }
  }

  async createTask(projectId: string, dto: CreateTaskDto) {
    const { project, serviceLine } = await this.getProjectContext(projectId);
    const firstColumn = getFirstColumnKey(serviceLine);
    const template = getServiceLineTemplate(serviceLine);
    const column = template.columns.find((col) => col.key === firstColumn)!;

    const maxSort = await this.prisma.task.aggregate({
      where: { projectId, boardColumn: firstColumn },
      _max: { sortOrder: true },
    });

    const priority = normalizePriority(dto.priority);
    const now = new Date();

    const task = await this.prisma.task.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : computeSlaDeadline(priority, now),
        assigneeId: dto.assigneeId,
        customFields: dto.customFields,
        boardColumn: firstColumn,
        status: column.status as never,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        isBlockedByGate: project.status === ProjectStatus.AWAITING_ADVANCE,
        gateReason:
          project.status === ProjectStatus.AWAITING_ADVANCE
            ? 'Awaiting advance payment'
            : null,
      },
      include: this.taskInclude,
    });

    return this.formatTask(task, serviceLine);
  }

  async updateTask(taskId: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { include: { workspace: true } } },
    });
    if (!existing) throw new NotFoundException('Task not found');

    const serviceLine = existing.project.workspace.serviceLine || 'Content Creation';

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority ? normalizePriority(dto.priority) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : dto.dueDate === null ? null : undefined,
        assigneeId: dto.assigneeId,
        customFields: dto.customFields,
      },
      include: this.taskInclude,
    });

    return this.formatTask(updated, serviceLine);
  }

  async moveTask(taskId: string, dto: MoveTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { include: { workspace: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');

    const serviceLine = task.project.workspace.serviceLine || 'Content Creation';
    const fromColumn = this.getColumn(serviceLine, task.boardColumn);
    const toColumn = this.getColumn(serviceLine, dto.boardColumn);

    this.enforceGate(task.project, serviceLine, dto.boardColumn);

    const deliveryPatch = this.enforceDeliveryGates(
      task,
      serviceLine,
      fromColumn,
      toColumn,
    );

    const maxSort = await this.prisma.task.aggregate({
      where: { projectId: task.projectId, boardColumn: dto.boardColumn },
      _max: { sortOrder: true },
    });

    const approvedAt =
      isApprovedColumn(toColumn) && !isApprovedColumn(fromColumn)
        ? new Date()
        : undefined;

    return this.formatTask(
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          boardColumn: dto.boardColumn,
          status: toColumn.status as never,
          sortOrder: dto.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
          isBlockedByGate: false,
          gateReason: null,
          ...(deliveryPatch ?? {}),
          ...(approvedAt ? { clientApprovedAt: approvedAt } : {}),
        },
        include: this.taskInclude,
      }),
      serviceLine,
    );
  }
}
