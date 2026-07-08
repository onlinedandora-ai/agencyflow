import { normalizePriority, type TaskPriority } from './task-priorities';

/** SOP delivery windows by priority (hours) */
export const TASK_SLA_HOURS: Record<TaskPriority, number> = {
  URGENT: 4,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 72,
};

export type TaskSlaMeta = {
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
): TaskSlaMeta {
  const priority = normalizePriority(task.priority);
  const targetHours = TASK_SLA_HOURS[priority];
  const targetMinutes = targetHours * 60;
  const completed =
    (!!doneColumnKey && task.boardColumn === doneColumnKey) || task.status === 'APPROVED';

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
