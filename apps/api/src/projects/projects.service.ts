import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import {
  columnIndex,
  getFirstColumnKey,
  getServiceLineTemplate,
  SERVICE_LINE_TEMPLATES,
} from '../common/service-line-templates';
import { normalizePriority } from '../common/task-priorities';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, MoveTaskDto, UpdateTaskDto } from './dto/task.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private taskInclude = {
    assignee: { select: { id: true, name: true, email: true, role: true } },
  };

  private projectInclude = {
    workspace: true,
    tasks: {
      include: this.taskInclude,
      orderBy: [{ boardColumn: 'asc' as const }, { sortOrder: 'asc' as const }],
    },
    invoices: true,
  };

  private formatTask(task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    boardColumn: string;
    sortOrder: number;
    priority: string | null;
    dueDate: Date | null;
    revisionRound: number;
    isBlockedByGate: boolean;
    gateReason: string | null;
    customFields: unknown;
    createdAt: Date;
    updatedAt: Date;
    assignee?: { id: string; name: string; email: string; role?: string } | null;
  }) {
    return {
      ...task,
      priority: normalizePriority(task.priority),
      customFields: (task.customFields as Record<string, string> | null) ?? null,
      dueDate: task.dueDate?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private computeProjectStats(
    tasks: Array<{ boardColumn: string; dueDate: Date | null; status: string; priority?: string | null }>,
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
    const completedCount = tasks.filter((task) => task.boardColumn === doneColumn).length;
    const urgentCount = tasks.filter((task) => normalizePriority(task.priority as string) === 'URGENT').length;
    const progressPercent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
    const health =
      overdueCount > 0 || urgentCount > 2 ? 'red' : urgentCount > 0 || progressPercent < 40 ? 'yellow' : 'green';

    return { overdueCount, completedCount, urgentCount, progressPercent, health };
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
      tasks: project.tasks.map((task) => this.formatTask(task)),
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
      ...this.formatTask(task),
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

    const task = await this.prisma.task.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        priority: normalizePriority(dto.priority),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
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

    return this.formatTask(task);
  }

  async updateTask(taskId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

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

    return this.formatTask(updated);
  }

  async moveTask(taskId: string, dto: MoveTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { include: { workspace: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');

    const serviceLine = task.project.workspace.serviceLine || 'Content Creation';
    const template = getServiceLineTemplate(serviceLine);
    const column = template.columns.find((col) => col.key === dto.boardColumn);
    if (!column) throw new BadRequestException('Invalid board column for this service line');

    this.enforceGate(task.project, serviceLine, dto.boardColumn);

    const maxSort = await this.prisma.task.aggregate({
      where: { projectId: task.projectId, boardColumn: dto.boardColumn },
      _max: { sortOrder: true },
    });

    return this.formatTask(
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          boardColumn: dto.boardColumn,
          status: column.status as never,
          sortOrder: dto.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
          isBlockedByGate: false,
          gateReason: null,
        },
        include: this.taskInclude,
      }),
    );
  }
}
