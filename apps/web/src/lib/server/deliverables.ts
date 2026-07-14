import {
  DeliverableStatus,
  DeliverableType,
  UserRole,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";

const MAX_FILE_BYTES = 2_000_000;
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

const DELIVERABLE_INCLUDE = {
  submittedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  sharedBy: { select: { id: true, name: true } },
} as const;

export class DeliverableHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const createDeliverableSchema = z.object({
  type: z.enum(DeliverableType),
  label: z.string().max(200).optional(),
  url: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  fileDataUrl: z.string().optional(),
});

export const reviewDeliverableSchema = z.object({
  reviewNote: z.string().optional(),
});

export const clientDeliverableFeedbackSchema = z.object({
  feedback: z.string().max(2000),
  approved: z.boolean().optional(),
});

type DeliverableRecord = {
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
      id?: string;
      name: string;
      workspace?: { name: string; company: string | null; email?: string | null };
    };
  };
};

function isManager(role: string) {
  return role === UserRole.ADMIN || role === UserRole.CLIENT_MANAGER;
}

function formatDeliverable(
  d: DeliverableRecord,
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

function validateCreate(dto: z.infer<typeof createDeliverableSchema>) {
  if (dto.type === DeliverableType.LINK) {
    if (!dto.url?.trim()) {
      throw new DeliverableHttpError("External link URL is required", 400);
    }
    if (!/^https?:\/\//i.test(dto.url.trim())) {
      throw new DeliverableHttpError(
        "Link must start with http:// or https://",
        400,
      );
    }
    return;
  }
  if (!dto.fileDataUrl?.trim()) {
    throw new DeliverableHttpError("Document file is required", 400);
  }
  if (!dto.fileDataUrl.startsWith("data:")) {
    throw new DeliverableHttpError("Invalid document upload", 400);
  }
  if (dto.fileDataUrl.length > MAX_FILE_BYTES) {
    throw new DeliverableHttpError("Document is too large (max ~2 MB)", 400);
  }
}

async function getTaskForActor(taskId: string, userId: string, role: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: { include: { workspace: true } } },
  });
  if (!task) throw new DeliverableHttpError("Task not found", 404);
  if (!isManager(role) && task.assigneeId !== userId) {
    throw new DeliverableHttpError(
      "Only the assignee or a manager can manage deliverables on this task",
      403,
    );
  }
  return task;
}

function requireManager(role: string) {
  if (!isManager(role)) {
    throw new DeliverableHttpError(
      "Only managers can perform this action",
      403,
    );
  }
}

export async function listForTask(taskId: string) {
  const items = await prisma.taskDeliverable.findMany({
    where: { taskId },
    include: DELIVERABLE_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return items.map((d) => formatDeliverable(d));
}

export async function createDeliverable(
  taskId: string,
  dto: z.infer<typeof createDeliverableSchema>,
  userId: string,
  role: string,
) {
  await getTaskForActor(taskId, userId, role);
  validateCreate(dto);

  const created = await prisma.taskDeliverable.create({
    data: {
      taskId,
      type: dto.type,
      label:
        dto.label?.trim() ||
        (dto.type === DeliverableType.LINK
          ? "External link"
          : dto.fileName || "Document"),
      url: dto.type === DeliverableType.LINK ? dto.url?.trim() : null,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      fileDataUrl:
        dto.type === DeliverableType.DOCUMENT ? dto.fileDataUrl : null,
    },
    include: DELIVERABLE_INCLUDE,
  });
  return formatDeliverable(created);
}

export async function submitDeliverable(
  taskId: string,
  deliverableId: string,
  userId: string,
  role: string,
) {
  await getTaskForActor(taskId, userId, role);
  const item = await prisma.taskDeliverable.findFirst({
    where: { id: deliverableId, taskId },
  });
  if (!item) throw new DeliverableHttpError("Deliverable not found", 404);
  if (
    item.status !== DeliverableStatus.DRAFT &&
    item.status !== DeliverableStatus.REJECTED
  ) {
    throw new DeliverableHttpError(
      "Only draft or rejected deliverables can be submitted",
      400,
    );
  }

  const updated = await prisma.taskDeliverable.update({
    where: { id: deliverableId },
    data: {
      status: DeliverableStatus.PENDING_REVIEW,
      submittedAt: new Date(),
      submittedById: userId,
      reviewNote: null,
      reviewedAt: null,
      reviewedById: null,
    },
    include: DELIVERABLE_INCLUDE,
  });
  return formatDeliverable(updated);
}

export async function approveDeliverable(
  taskId: string,
  deliverableId: string,
  userId: string,
  role: string,
  dto: z.infer<typeof reviewDeliverableSchema>,
) {
  requireManager(role);
  const item = await prisma.taskDeliverable.findFirst({
    where: { id: deliverableId, taskId },
  });
  if (!item) throw new DeliverableHttpError("Deliverable not found", 404);
  if (item.status !== DeliverableStatus.PENDING_REVIEW) {
    throw new DeliverableHttpError("Deliverable is not pending review", 400);
  }

  const updated = await prisma.taskDeliverable.update({
    where: { id: deliverableId },
    data: {
      status: DeliverableStatus.APPROVED,
      reviewedAt: new Date(),
      reviewedById: userId,
      reviewNote: dto.reviewNote,
    },
    include: DELIVERABLE_INCLUDE,
  });
  return formatDeliverable(updated);
}

export async function rejectDeliverable(
  taskId: string,
  deliverableId: string,
  userId: string,
  role: string,
  dto: z.infer<typeof reviewDeliverableSchema>,
) {
  requireManager(role);
  if (!dto.reviewNote?.trim()) {
    throw new DeliverableHttpError(
      "Please provide feedback when rejecting",
      400,
    );
  }
  const item = await prisma.taskDeliverable.findFirst({
    where: { id: deliverableId, taskId },
  });
  if (!item) throw new DeliverableHttpError("Deliverable not found", 404);
  if (item.status !== DeliverableStatus.PENDING_REVIEW) {
    throw new DeliverableHttpError("Deliverable is not pending review", 400);
  }

  const updated = await prisma.taskDeliverable.update({
    where: { id: deliverableId },
    data: {
      status: DeliverableStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedById: userId,
      reviewNote: dto.reviewNote,
    },
    include: DELIVERABLE_INCLUDE,
  });
  return formatDeliverable(updated);
}

export async function shareDeliverable(
  taskId: string,
  deliverableId: string,
  userId: string,
  role: string,
) {
  requireManager(role);
  const item = await prisma.taskDeliverable.findFirst({
    where: { id: deliverableId, taskId },
  });
  if (!item) throw new DeliverableHttpError("Deliverable not found", 404);
  if (
    item.status !== DeliverableStatus.APPROVED &&
    item.status !== DeliverableStatus.SHARED
  ) {
    throw new DeliverableHttpError(
      "Only approved deliverables can be shared with the client",
      400,
    );
  }

  const token = item.publicToken ?? randomBytes(18).toString("hex");
  const updated = await prisma.taskDeliverable.update({
    where: { id: deliverableId },
    data: {
      status: DeliverableStatus.SHARED,
      sharedAt: new Date(),
      sharedById: userId,
      publicToken: token,
    },
    include: {
      ...DELIVERABLE_INCLUDE,
      task: {
        select: {
          id: true,
          title: true,
          project: {
            select: {
              name: true,
              workspace: {
                select: { name: true, company: true, email: true },
              },
            },
          },
        },
      },
    },
  });

  const formatted = formatDeliverable(updated);
  const workspace = updated.task?.project?.workspace;
  const clientName = workspace?.company || workspace?.name || "Client";
  const message = `Hi ${clientName}, your deliverable "${updated.label}" for ${updated.task?.title} is ready for review: ${formatted.publicUrl}`;
  const mailto = workspace?.email
    ? `mailto:${encodeURIComponent(workspace.email)}?subject=${encodeURIComponent(`Deliverable ready — ${updated.task?.title}`)}&body=${encodeURIComponent(message)}`
    : null;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return {
    deliverable: formatted,
    message,
    mailto,
    whatsapp,
    publicUrl: formatted.publicUrl,
  };
}

export async function listPendingReview() {
  const items = await prisma.taskDeliverable.findMany({
    where: { status: DeliverableStatus.PENDING_REVIEW },
    include: {
      ...DELIVERABLE_INCLUDE,
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
    orderBy: { submittedAt: "asc" },
  });
  return items.map((d) => formatDeliverable(d));
}

export async function listSharedForWorkspace(billingToken: string) {
  const workspace = await prisma.clientWorkspace.findUnique({
    where: { billingToken },
  });
  if (!workspace) throw new DeliverableHttpError("Portal not found", 404);

  const items = await prisma.taskDeliverable.findMany({
    where: {
      status: {
        in: [DeliverableStatus.SHARED, DeliverableStatus.CLIENT_APPROVED],
      },
      task: { project: { workspaceId: workspace.id } },
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          project: { select: { name: true } },
        },
      },
    },
    orderBy: { sharedAt: "desc" },
  });
  return items.map((d) => formatDeliverable(d));
}

export async function getPublicDeliverable(token: string) {
  const item = await prisma.taskDeliverable.findUnique({
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
  if (!item) throw new DeliverableHttpError("Deliverable not found", 404);
  if (
    item.status !== DeliverableStatus.SHARED &&
    item.status !== DeliverableStatus.CLIENT_APPROVED
  ) {
    throw new DeliverableHttpError("Deliverable is not available", 404);
  }
  return formatDeliverable(item, { includeFile: true });
}

export async function clientFeedback(
  token: string,
  dto: z.infer<typeof clientDeliverableFeedbackSchema>,
) {
  const item = await prisma.taskDeliverable.findUnique({
    where: { publicToken: token },
  });
  if (!item) throw new DeliverableHttpError("Deliverable not found", 404);
  if (item.status !== DeliverableStatus.SHARED) {
    throw new DeliverableHttpError("Feedback already recorded", 400);
  }

  const updated = await prisma.taskDeliverable.update({
    where: { id: item.id },
    data: dto.approved
      ? {
          status: DeliverableStatus.CLIENT_APPROVED,
          clientApprovedAt: new Date(),
          clientFeedback: dto.feedback || "Approved",
        }
      : {
          clientFeedback: dto.feedback,
          status: DeliverableStatus.REJECTED,
          reviewNote: `Client feedback: ${dto.feedback}`,
        },
    include: DELIVERABLE_INCLUDE,
  });
  return {
    message: dto.approved
      ? "Thank you — approval recorded."
      : "Feedback sent to the team.",
    deliverable: formatDeliverable(updated),
  };
}

export async function hasApprovedDeliverable(taskId: string) {
  const count = await prisma.taskDeliverable.count({
    where: {
      taskId,
      status: {
        in: [
          DeliverableStatus.APPROVED,
          DeliverableStatus.SHARED,
          DeliverableStatus.CLIENT_APPROVED,
        ],
      },
    },
  });
  return count > 0;
}

export function handleDeliverableError(error: unknown) {
  if (error instanceof DeliverableHttpError) {
    return { message: error.message, status: error.status };
  }
  throw error;
}
