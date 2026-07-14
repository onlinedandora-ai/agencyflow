import { DeliverableStatus, ProjectStatus } from "@prisma/client";
import { z } from "zod";
import {
  isApprovedColumn,
  isClientReviewColumn,
  requiresBillableAcknowledgement,
} from "@/lib/delivery-gates";
import {
  columnIndex,
  getFirstColumnKey,
  getServiceLineTemplate,
  SERVICE_LINE_TEMPLATES,
  type BoardColumn,
} from "@/lib/service-line-templates";
import { computeSlaDeadline, computeTaskSla, normalizePriority, TASK_PRIORITIES } from "@/lib/task-utils";
import { prisma } from "@/lib/server/prisma";

const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true, email: true, role: true } },
  qaSignedOffBy: { select: { id: true, name: true, email: true, role: true } },
};

export class ProjectHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: z.string().nullable().optional(),
  assigneeId: z.string().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
});

export const moveTaskSchema = z.object({
  boardColumn: z.string().min(1),
  sortOrder: z.number().optional(),
});

function formatTask(
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

function computeProjectStats(
  tasks: Array<{
    boardColumn: string;
    dueDate: Date | null;
    status: string;
    priority?: string | null;
    createdAt?: Date;
    sla?: { breached: boolean };
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
      task.status !== "APPROVED",
  ).length;
  const slaBreaches = tasks.filter((task) => {
    if (task.sla) return task.sla.breached;
    return computeTaskSla(
      {
        priority: task.priority ?? "MEDIUM",
        dueDate: task.dueDate,
        createdAt: task.createdAt ?? now,
        boardColumn: task.boardColumn,
        status: task.status,
      },
      doneColumn,
    ).breached;
  }).length;
  const completedCount = tasks.filter((task) => task.boardColumn === doneColumn).length;
  const urgentCount = tasks.filter((task) => normalizePriority(task.priority as string) === "URGENT").length;
  const progressPercent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const health =
    overdueCount > 0 || urgentCount > 2 ? "red" : urgentCount > 0 || progressPercent < 40 ? "yellow" : "green";

  return { overdueCount, slaBreaches, completedCount, urgentCount, progressPercent, health };
}

function formatBoardTask(
  task: {
    id: string;
    title: string;
    status: string;
    boardColumn: string;
    sortOrder: number;
    priority: string | null;
    dueDate: Date | null;
    revisionRound: number;
    qaSignedOffAt: Date | null;
    billableRevisionPending: boolean;
    createdAt: Date;
  },
  serviceLine: string,
  doneColumnKey: string | undefined,
  isGateLocked: boolean,
) {
  const sla = computeTaskSla(task, doneColumnKey);

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    boardColumn: task.boardColumn,
    sortOrder: task.sortOrder,
    priority: normalizePriority(task.priority),
    dueDate: task.dueDate?.toISOString() ?? sla.deadline,
    revisionRound: task.revisionRound,
    qaSignedOffAt: task.qaSignedOffAt?.toISOString() ?? null,
    billableRevisionPending: task.billableRevisionPending,
    isBlockedByGate: isGateLocked && columnIndex(serviceLine, task.boardColumn) > 0,
    sla,
  };
}

export function getTemplates() {
  return Object.values(SERVICE_LINE_TEMPLATES);
}

export async function findAllProjects() {
  const projects = await prisma.project.findMany({
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
    orderBy: { updatedAt: "desc" },
  });

  return projects.map((project) => {
    const serviceLine = project.workspace.serviceLine || "Content Creation";
    const stats = computeProjectStats(project.tasks, serviceLine);
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

export async function findProjectById(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workspace: true,
      tasks: {
        include: TASK_INCLUDE,
        orderBy: [{ boardColumn: "asc" }, { sortOrder: "asc" }],
      },
      invoices: true,
    },
  });
  if (!project) throw new ProjectHttpError("Project not found", 404);

  const serviceLine = project.workspace.serviceLine || "Content Creation";
  const template = getServiceLineTemplate(serviceLine);
  const isGateLocked = project.status === ProjectStatus.AWAITING_ADVANCE;

  return {
    ...project,
    serviceLine,
    template,
    isGateLocked,
    gateMessage: isGateLocked
      ? "Advance payment required before tasks can move beyond the first column"
      : null,
    tasks: project.tasks.map((task) => formatTask(task, serviceLine)),
  };
}

export async function getTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      ...TASK_INCLUDE,
      project: {
        include: {
          workspace: { select: { id: true, name: true, company: true, serviceLine: true } },
        },
      },
    },
  });
  if (!task) throw new ProjectHttpError("Task not found", 404);

  const serviceLine = task.project.workspace.serviceLine || "Content Creation";
  const template = getServiceLineTemplate(serviceLine);
  const column = template.columns.find((col) => col.key === task.boardColumn);

  return {
    ...formatTask(task, serviceLine),
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

export async function getBoard(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      status: true,
      workspace: {
        select: { id: true, name: true, company: true, serviceLine: true },
      },
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          boardColumn: true,
          sortOrder: true,
          priority: true,
          dueDate: true,
          revisionRound: true,
          qaSignedOffAt: true,
          billableRevisionPending: true,
          createdAt: true,
        },
        orderBy: [{ boardColumn: "asc" }, { sortOrder: "asc" }],
      },
    },
  });
  if (!project) throw new ProjectHttpError("Project not found", 404);

  const serviceLine = project.workspace.serviceLine || "Content Creation";
  const template = getServiceLineTemplate(serviceLine);
  const isGateLocked = project.status === ProjectStatus.AWAITING_ADVANCE;
  const doneColumnKey = template.columns[template.columns.length - 1]?.key;

  const formattedTasks = project.tasks.map((task) =>
    formatBoardTask(task, serviceLine, doneColumnKey, isGateLocked),
  );

  const tasksByColumn = new Map<string, typeof formattedTasks>();
  for (const task of formattedTasks) {
    const list = tasksByColumn.get(task.boardColumn) ?? [];
    list.push(task);
    tasksByColumn.set(task.boardColumn, list);
  }

  const columns = template.columns.map((col) => ({
    ...col,
    tasks: tasksByColumn.get(col.key) ?? [],
  }));

  const stats = computeProjectStats(
    formattedTasks.map((task) => ({
      boardColumn: task.boardColumn,
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
      status: task.status,
      priority: task.priority,
      sla: task.sla,
    })),
    serviceLine,
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
    serviceLine,
    template,
    isGateLocked,
    gateMessage: isGateLocked
      ? "Advance payment required before tasks can move beyond the first column"
      : null,
    columns,
    ...stats,
  };
}

async function getProjectContext(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: true },
  });
  if (!project) throw new ProjectHttpError("Project not found", 404);
  const serviceLine = project.workspace.serviceLine || "Content Creation";
  return { project, serviceLine };
}

function getColumn(serviceLine: string, columnKey: string): BoardColumn {
  const template = getServiceLineTemplate(serviceLine);
  const column = template.columns.find((col) => col.key === columnKey);
  if (!column) throw new ProjectHttpError("Invalid board column for this service line", 400);
  return column;
}

async function deliverableCount(taskId: string, statuses: DeliverableStatus[]) {
  return prisma.taskDeliverable.count({
    where: { taskId, status: { in: statuses } },
  });
}

async function enforceDeliveryGates(
  task: {
    id: string;
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
      throw new ProjectHttpError(
        "Peer QA sign-off is required before moving a task to client review",
        400,
      );
    }
    const shared = await deliverableCount(task.id, [
      DeliverableStatus.SHARED,
      DeliverableStatus.CLIENT_APPROVED,
    ]);
    if (shared === 0) {
      throw new ProjectHttpError(
        "Share at least one approved deliverable with the client before moving to client review",
        400,
      );
    }
    if (task.billableRevisionPending) {
      throw new ProjectHttpError(
        "Revision round 3+ is billable — a manager must acknowledge before client review resumes",
        400,
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

export async function signOffQa(taskId: string, actorId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: { include: { workspace: true } } },
  });
  if (!task) throw new ProjectHttpError("Task not found", 404);

  const serviceLine = task.project.workspace.serviceLine || "Content Creation";
  const clientReviewIdx = getServiceLineTemplate(serviceLine).columns.findIndex((col) =>
    isClientReviewColumn(col),
  );

  if (clientReviewIdx < 0) {
    throw new ProjectHttpError("This service line has no client review stage", 400);
  }

  const currentIdx = columnIndex(serviceLine, task.boardColumn);
  if (currentIdx >= clientReviewIdx) {
    throw new ProjectHttpError("QA sign-off must happen before client review", 400);
  }

  if (task.assigneeId && task.assigneeId === actorId) {
    throw new ProjectHttpError("QA sign-off must be done by someone other than the assignee", 400);
  }

  const approved = await deliverableCount(taskId, [
    DeliverableStatus.APPROVED,
    DeliverableStatus.SHARED,
    DeliverableStatus.CLIENT_APPROVED,
  ]);
  if (approved === 0) {
    throw new ProjectHttpError(
      "At least one manager-approved deliverable is required before QA sign-off",
      400,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.task.update({
      where: { id: taskId },
      data: {
        qaSignedOffAt: new Date(),
        qaSignedOffById: actorId,
      },
      include: TASK_INCLUDE,
    });

    await tx.auditLog.create({
      data: {
        actorId,
        entityType: "task",
        entityId: taskId,
        action: "qa_signoff",
        metadata: { boardColumn: task.boardColumn, serviceLine },
      },
    });

    return row;
  });

  return formatTask(updated, serviceLine);
}

export async function acknowledgeBillableRevision(taskId: string, actorId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: { include: { workspace: true } } },
  });
  if (!task) throw new ProjectHttpError("Task not found", 404);
  if (!task.billableRevisionPending) {
    throw new ProjectHttpError("This task has no pending billable revision", 400);
  }

  const serviceLine = task.project.workspace.serviceLine || "Content Creation";

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.task.update({
      where: { id: taskId },
      data: { billableRevisionPending: false },
      include: TASK_INCLUDE,
    });

    await tx.auditLog.create({
      data: {
        actorId,
        entityType: "task",
        entityId: taskId,
        action: "billable_revision_acknowledged",
        metadata: { revisionRound: task.revisionRound },
      },
    });

    return row;
  });

  return formatTask(updated, serviceLine);
}

function enforceGate(
  project: { status: ProjectStatus },
  serviceLine: string,
  targetColumn: string,
) {
  if (project.status !== ProjectStatus.AWAITING_ADVANCE) return;

  const targetIdx = columnIndex(serviceLine, targetColumn);
  if (targetIdx > 0) {
    throw new ProjectHttpError(
      "Advance payment must be confirmed before moving tasks beyond the first column",
      400,
    );
  }
}

export async function createTask(projectId: string, dto: z.infer<typeof createTaskSchema>) {
  const { project, serviceLine } = await getProjectContext(projectId);
  const firstColumn = getFirstColumnKey(serviceLine);
  const template = getServiceLineTemplate(serviceLine);
  const column = template.columns.find((col) => col.key === firstColumn)!;

  const maxSort = await prisma.task.aggregate({
    where: { projectId, boardColumn: firstColumn },
    _max: { sortOrder: true },
  });

  const priority = normalizePriority(dto.priority);
  const now = new Date();

  const task = await prisma.task.create({
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
        project.status === ProjectStatus.AWAITING_ADVANCE ? "Awaiting advance payment" : null,
    },
    include: TASK_INCLUDE,
  });

  return formatTask(task, serviceLine);
}

export async function updateTask(taskId: string, dto: z.infer<typeof updateTaskSchema>) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: { include: { workspace: true } } },
  });
  if (!existing) throw new ProjectHttpError("Task not found", 404);

  const serviceLine = existing.project.workspace.serviceLine || "Content Creation";

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: dto.title,
      description: dto.description,
      priority: dto.priority ? normalizePriority(dto.priority) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : dto.dueDate === null ? null : undefined,
      assigneeId: dto.assigneeId,
      customFields: dto.customFields,
    },
    include: TASK_INCLUDE,
  });

  return formatTask(updated, serviceLine);
}

export async function moveTask(taskId: string, dto: z.infer<typeof moveTaskSchema>) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: { include: { workspace: true } } },
  });
  if (!task) throw new ProjectHttpError("Task not found", 404);

  const serviceLine = task.project.workspace.serviceLine || "Content Creation";
  const fromColumn = getColumn(serviceLine, task.boardColumn);
  const toColumn = getColumn(serviceLine, dto.boardColumn);

  enforceGate(task.project, serviceLine, dto.boardColumn);

  const deliveryPatch = await enforceDeliveryGates(task, serviceLine, fromColumn, toColumn);

  const maxSort = await prisma.task.aggregate({
    where: { projectId: task.projectId, boardColumn: dto.boardColumn },
    _max: { sortOrder: true },
  });

  const approvedAt =
    isApprovedColumn(toColumn) && !isApprovedColumn(fromColumn) ? new Date() : undefined;

  return formatTask(
    await prisma.task.update({
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
      include: TASK_INCLUDE,
    }),
    serviceLine,
  );
}

export function handleProjectError(error: unknown) {
  if (error instanceof ProjectHttpError) {
    return { message: error.message, status: error.status };
  }
  throw error;
}
