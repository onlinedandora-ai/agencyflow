export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

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

export function canManageTasks(role?: string | null) {
  return role === "ADMIN" || role === "CLIENT_MANAGER";
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
