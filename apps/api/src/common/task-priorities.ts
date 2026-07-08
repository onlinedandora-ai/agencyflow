export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export function normalizePriority(value?: string | null): TaskPriority {
  const upper = (value || 'MEDIUM').toUpperCase();
  if (TASK_PRIORITIES.includes(upper as TaskPriority)) return upper as TaskPriority;
  return 'MEDIUM';
}
