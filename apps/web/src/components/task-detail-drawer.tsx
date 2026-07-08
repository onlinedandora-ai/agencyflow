"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  Clock,
  Pencil,
  Save,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, cn, type TaskItem, type TeamMember } from "@/lib/api";
import {
  canManageTasks,
  formatDueCountdown,
  isOverdue,
  normalizePriority,
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  ROLE_LABELS,
  TASK_PRIORITIES,
  type TaskPriority,
} from "@/lib/task-utils";

export type TaskFormData = {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  assigneeId: string;
  customFields: Record<string, string>;
};

type TaskDetailDrawerProps = {
  open: boolean;
  mode: "create" | "view";
  task: TaskItem | null;
  projectId: string;
  token: string;
  userRole: string;
  customFieldLabels: Record<string, string>;
  doneColumnKey?: string;
  onClose: () => void;
  onSaved?: (task: TaskItem) => void;
};

const emptyForm = (): TaskFormData => ({
  title: "",
  description: "",
  priority: "MEDIUM",
  dueDate: "",
  assigneeId: "",
  customFields: {},
});

export function TaskDetailDrawer({
  open,
  mode,
  task,
  projectId,
  token,
  userRole,
  customFieldLabels,
  doneColumnKey,
  onClose,
  onSaved,
}: TaskDetailDrawerProps) {
  const queryClient = useQueryClient();
  const canEdit = canManageTasks(userRole);
  const [editing, setEditing] = useState(mode === "create");
  const [form, setForm] = useState<TaskFormData>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const { data: team = [] } = useQuery({
    queryKey: ["team-assignable"],
    queryFn: () => api.getAssignableTeam(token),
    enabled: open && canEdit,
  });

  const { data: taskDetail } = useQuery({
    queryKey: ["task", task?.id],
    queryFn: () => api.getTask(token, task!.id),
    enabled: open && mode === "view" && !!task?.id,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "create") {
      setEditing(true);
      setForm(emptyForm());
      return;
    }
    if (task) {
      setEditing(false);
      setForm({
        title: task.title,
        description: task.description || "",
        priority: normalizePriority(task.priority),
        dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
        assigneeId: task.assignee?.id || "",
        customFields: task.customFields || {},
      });
    }
  }, [open, mode, task]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    if (task?.id) queryClient.invalidateQueries({ queryKey: ["task", task.id] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.createTask(token, projectId, {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        assigneeId: form.assigneeId || undefined,
        customFields: Object.keys(form.customFields).length ? form.customFields : undefined,
      }),
    onSuccess: (created) => {
      invalidate();
      onSaved?.(created);
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateTask(token, task!.id, {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        assigneeId: form.assigneeId || undefined,
        customFields: form.customFields,
      }),
    onSuccess: (updated) => {
      invalidate();
      setEditing(false);
      onSaved?.(updated);
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!open) return null;

  const displayTask = taskDetail || task;
  const priority = normalizePriority(displayTask?.priority);
  const priorityStyle = PRIORITY_STYLES[priority];
  const overdue = isOverdue(displayTask?.dueDate, displayTask?.boardColumn, doneColumnKey);
  const dueLabel = formatDueCountdown(displayTask?.dueDate);
  const columnLabel =
    taskDetail?.columnLabel ||
    displayTask?.boardColumn?.replace(/_/g, " ") ||
    "—";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "create") createMutation.mutate();
    else updateMutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {mode === "create" ? "New task" : "Task details"}
            </p>
            {mode === "view" && displayTask && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", priorityStyle.badge)}>
                  {PRIORITY_LABELS[priority]}
                </span>
                <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-xs capitalize text-[var(--color-muted)]">
                  {columnLabel}
                </span>
                {overdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                    <AlertCircle className="h-3 w-3" />
                    Overdue
                  </span>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-primary)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          {editing && canEdit ? (
            <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
              <Field label="Title" required>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="What needs to be delivered?"
                  required
                />
              </Field>

              <Field label="Brief / definition of done">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Scope, acceptance criteria, references..."
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Urgency" required>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Due date">
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="Assign to">
                <select
                  value={form.assigneeId}
                  onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {team.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} · {ROLE_LABELS[member.role] || member.role}
                    </option>
                  ))}
                </select>
              </Field>

              {Object.keys(customFieldLabels).length > 0 && (
                <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Delivery fields
                  </p>
                  {Object.entries(customFieldLabels).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        value={form.customFields[key] || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            customFields: { ...form.customFields, [key]: e.target.value },
                          })
                        }
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                      />
                    </Field>
                  ))}
                </div>
              )}
            </form>
          ) : (
            displayTask && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold leading-snug">{displayTask.title}</h2>
                  {displayTask.description ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--color-muted)]">
                      {displayTask.description}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm italic text-[var(--color-muted)]">No brief added yet.</p>
                  )}
                </div>

                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Allocated to
                  </p>
                  {displayTask.assignee ? (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-[var(--color-primary)]">
                        {displayTask.assignee.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium">{displayTask.assignee.name}</p>
                        <p className="text-sm text-[var(--color-muted)]">{displayTask.assignee.email}</p>
                        {"role" in displayTask.assignee && displayTask.assignee.role && (
                          <p className="text-xs text-[var(--color-primary)]">
                            {ROLE_LABELS[displayTask.assignee.role as string] || displayTask.assignee.role}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 flex items-center gap-2 text-sm text-[var(--color-muted)]">
                      <User className="h-4 w-4" />
                      Not assigned yet
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <InfoCard icon={AlertCircle} label="Urgency" value={PRIORITY_LABELS[priority]} />
                  <InfoCard
                    icon={Calendar}
                    label="Timeline"
                    value={dueLabel || "No due date"}
                    highlight={overdue}
                  />
                </div>

                {displayTask.revisionRound > 0 && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Revision round {displayTask.revisionRound}
                  </p>
                )}

                {displayTask.customFields && Object.keys(displayTask.customFields).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                      Delivery details
                    </p>
                    {Object.entries(displayTask.customFields).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-4 text-sm">
                        <span className="text-[var(--color-muted)]">{customFieldLabels[key] || key}</span>
                        <span className="text-right font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {displayTask.createdAt && (
                  <div className="flex items-center gap-2 border-t pt-4 text-xs text-[var(--color-muted)]">
                    <Clock className="h-3.5 w-3.5" />
                    Created {new Date(displayTask.createdAt).toLocaleDateString()}
                    {displayTask.updatedAt && displayTask.updatedAt !== displayTask.createdAt && (
                      <> · Updated {new Date(displayTask.updatedAt).toLocaleDateString()}</>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        <div className="border-t border-[var(--color-border)] px-5 py-4">
          {editing && canEdit ? (
            <div className="flex gap-2">
              {mode === "view" && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                form="task-form"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
              >
                <Save className="h-4 w-4" />
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : mode === "create"
                    ? "Create task"
                    : "Save changes"}
              </button>
            </div>
          ) : canEdit && mode === "view" ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary)]"
            >
              <Pencil className="h-4 w-4" />
              Edit task
            </button>
          ) : (
            <p className="text-center text-xs text-[var(--color-muted)]">
              Only managers can create or edit tasks. Drag cards to update status.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        highlight ? "border-red-200 bg-red-50" : "border-[var(--color-border)] bg-white",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={cn("mt-1 text-sm font-medium", highlight && "text-red-800")}>{value}</p>
    </div>
  );
}
