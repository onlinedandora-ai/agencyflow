export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** SOP delivery windows by priority */
export const TASK_SLA_HOURS: Record<TaskPriority, number> = {
  URGENT: 4,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 72,
};

export type TaskSla = {
  active: boolean;
  targetHours: number;
  targetMinutes: number;
  deadline: string | null;
  remainingMinutes: number;
  elapsedMinutes: number;
  breached: boolean;
  atRisk: boolean;
  completed: boolean;
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRIORITY_STYLES: Record<TaskPriority, { dot: string; badge: string; bar: string }> = {
  LOW: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-700",
    bar: "bg-slate-300",
  },
  MEDIUM: {
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-800",
    bar: "bg-blue-400",
  },
  HIGH: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-900",
    bar: "bg-amber-400",
  },
  URGENT: {
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-800",
    bar: "bg-red-500",
  },
};

export function normalizePriority(value?: string | null): TaskPriority {
  const upper = (value || "MEDIUM").toUpperCase();
  if (TASK_PRIORITIES.includes(upper as TaskPriority)) return upper as TaskPriority;
  return "MEDIUM";
}

export function computeSlaDeadline(priority: TaskPriority, from = new Date()) {
  const hours = TASK_SLA_HOURS[priority];
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

export function computeTaskSla(
  task: {
    priority: string | null;
    dueDate: Date | null;
    createdAt: Date;
    boardColumn: string;
    status: string;
  },
  doneColumnKey?: string,
): TaskSla {
  const priority = normalizePriority(task.priority);
  const targetHours = TASK_SLA_HOURS[priority];
  const targetMinutes = targetHours * 60;
  const completed =
    (!!doneColumnKey && task.boardColumn === doneColumnKey) || task.status === "APPROVED";

  if (completed) {
    return {
      active: false,
      targetHours,
      targetMinutes,
      deadline: task.dueDate?.toISOString() ?? null,
      remainingMinutes: 0,
      elapsedMinutes: 0,
      breached: false,
      atRisk: false,
      completed: true,
    };
  }

  const deadline = task.dueDate ?? computeSlaDeadline(priority, task.createdAt);
  const now = Date.now();
  const remainingMs = deadline.getTime() - now;
  const remainingMinutes = Math.max(0, Math.ceil(remainingMs / (60 * 1000)));
  const elapsedMinutes = Math.floor((now - task.createdAt.getTime()) / (60 * 1000));
  const breached = remainingMs < 0;
  const atRisk = !breached && remainingMinutes <= Math.min(60, Math.round(targetMinutes * 0.15));

  return {
    active: true,
    targetHours,
    targetMinutes,
    deadline: deadline.toISOString(),
    remainingMinutes,
    elapsedMinutes,
    breached,
    atRisk,
    completed: false,
  };
}

export function isAdmin(role?: string | null) {
  return role === "ADMIN";
}

export function canManageTasks(role?: string | null) {
  return role === "ADMIN" || role === "CLIENT_MANAGER";
}

export function canReviewDeliverables(role?: string | null) {
  return canManageTasks(role);
}

export function isDeliveryExec(role?: string | null) {
  return role === "DELIVERY_EXEC";
}

export function formatSlaCountdown(sla?: TaskSla | null) {
  if (!sla || !sla.active) return null;
  if (sla.breached) {
    const overdueHours = Math.max(1, Math.ceil(sla.elapsedMinutes / 60 - sla.targetHours));
    return overdueHours < 24 ? `${overdueHours}h overdue` : `${Math.ceil(overdueHours / 24)}d overdue`;
  }
  if (sla.remainingMinutes < 60) return `${sla.remainingMinutes}m left`;
  if (sla.remainingMinutes < 24 * 60) {
    const hours = Math.ceil(sla.remainingMinutes / 60);
    return `${hours}h left`;
  }
  const days = Math.ceil(sla.remainingMinutes / (60 * 24));
  return `${days}d left`;
}

export function getSlaTimerClass(sla?: TaskSla | null) {
  if (!sla || !sla.active) return "text-muted-foreground";
  if (sla.breached) return "font-medium text-destructive";
  if (sla.atRisk) return "font-medium text-amber-600";
  return "text-muted-foreground";
}

export function sopDeadlinePreview(priority: TaskPriority, from = new Date()) {
  const hours = TASK_SLA_HOURS[priority];
  const deadline = new Date(from.getTime() + hours * 60 * 60 * 1000);
  return { hours, deadline };
}

export function formatDueCountdown(dueDate?: string | null) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    const overdueDays = Math.abs(diffDays);
    return overdueDays === 0 ? "Overdue today" : `${overdueDays}d overdue`;
  }
  if (diffHours < 24) return `${diffHours}h left`;
  if (diffDays === 1) return "Due tomorrow";
  return `${diffDays}d left`;
}

export function isOverdue(dueDate?: string | null, boardColumn?: string, doneColumn?: string) {
  if (!dueDate || boardColumn === doneColumn) return false;
  return new Date(dueDate) < new Date();
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  CLIENT_MANAGER: "Manager",
  DELIVERY_EXEC: "Delivery",
  CLIENT: "Client",
  VENDOR: "Vendor",
};

export type ProjectHealth = "green" | "yellow" | "red";

export const HEALTH_STYLES: Record<ProjectHealth, { label: string; dot: string; bg: string }> = {
  green: { label: "On track", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-800" },
  yellow: { label: "At risk", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-900" },
  red: { label: "Needs attention", dot: "bg-red-500", bg: "bg-red-50 text-red-800" },
};
