"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Calendar, CheckCircle2, Clock, Pencil, Save, ShieldCheck, User } from "lucide-react";
import { useEffect, useState } from "react";
import { TaskSlaTimer } from "@/components/task-sla-timer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api, type TaskItem } from "@/lib/api";
import {
  canManageTasks,
  formatDueCountdown,
  isOverdue,
  normalizePriority,
  PRIORITY_LABELS,
  ROLE_LABELS,
  sopDeadlinePreview,
  TASK_PRIORITIES,
  TASK_SLA_HOURS,
  type TaskPriority,
} from "@/lib/task-utils";
import { cn } from "@/lib/utils";

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

  const qaSignoffMutation = useMutation({
    mutationFn: () => api.signOffTaskQa(token, task!.id),
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const billableAckMutation = useMutation({
    mutationFn: () => api.acknowledgeBillableRevision(token, task!.id),
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const displayTask = taskDetail || task;
  const canAckBillable = userRole === "ADMIN" || userRole === "CLIENT_MANAGER";
  const clientReviewKeys =
    taskDetail?.template?.columns
      .filter((col) => col.status === "CLIENT_REVIEW")
      .map((col) => col.key) ?? [];
  const isBeforeClientReview =
    displayTask?.boardColumn && !clientReviewKeys.includes(displayTask.boardColumn);
  const priority = normalizePriority(displayTask?.priority);
  const overdue = isOverdue(displayTask?.dueDate, displayTask?.boardColumn, doneColumnKey);
  const dueLabel = formatDueCountdown(displayTask?.dueDate);
  const columnLabel =
    taskDetail?.columnLabel || displayTask?.boardColumn?.replace(/_/g, " ") || "—";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "create") createMutation.mutate();
    else updateMutation.mutate();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>{mode === "create" ? "New task" : "Task details"}</SheetTitle>
          {mode === "view" && displayTask && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="secondary">{PRIORITY_LABELS[priority]}</Badge>
              <Badge variant="outline" className="capitalize">
                {columnLabel}
              </Badge>
              {displayTask?.sla?.breached && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  SLA breach
                </Badge>
              )}
              {overdue && !displayTask?.sla?.breached && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Overdue
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {editing && canEdit ? (
            <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="task-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="What needs to be delivered?"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-description">Brief / definition of done</Label>
                <Textarea
                  id="task-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  placeholder="Scope, acceptance criteria, references..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="task-priority">Urgency</Label>
                  <select
                    id="task-priority"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-due">Due date</Label>
                  <Input
                    id="task-due"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
              </div>

              {mode === "create" && !form.dueDate && (
                <p className="rounded-lg border border-indigo-200/50 bg-indigo-50/40 px-3 py-2 text-xs text-muted-foreground">
                  SOP timer: auto due in <strong>{TASK_SLA_HOURS[form.priority]} hours</strong> for{" "}
                  {PRIORITY_LABELS[form.priority].toLowerCase()} priority (
                  {sopDeadlinePreview(form.priority).deadline.toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  ). Override with a custom due date above.
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="task-assignee">Assign to</Label>
                <select
                  id="task-assignee"
                  value={form.assigneeId}
                  onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="">Unassigned</option>
                  {team.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} · {ROLE_LABELS[member.role] || member.role}
                    </option>
                  ))}
                </select>
              </div>

              {Object.keys(customFieldLabels).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                      Delivery fields
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(customFieldLabels).map(([key, label]) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`field-${key}`}>{label}</Label>
                        <Input
                          id={`field-${key}`}
                          value={form.customFields[key] || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              customFields: { ...form.customFields, [key]: e.target.value },
                            })
                          }
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </form>
          ) : (
            displayTask && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold leading-snug">{displayTask.title}</h2>
                  {displayTask.description ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {displayTask.description}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm italic text-muted-foreground">No brief added yet.</p>
                  )}
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                      Allocated to
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {displayTask.assignee ? (
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {displayTask.assignee.name
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{displayTask.assignee.name}</p>
                          <p className="text-sm text-muted-foreground">{displayTask.assignee.email}</p>
                          {"role" in displayTask.assignee && displayTask.assignee.role && (
                            <p className="text-xs text-primary">
                              {ROLE_LABELS[displayTask.assignee.role as string] || displayTask.assignee.role}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        Not assigned yet
                      </p>
                    )}
                  </CardContent>
                </Card>

                {displayTask.sla && (
                  <Card
                    className={cn(
                      displayTask.sla.breached && "border-destructive/30 bg-destructive/5",
                      displayTask.sla.atRisk && !displayTask.sla.breached && "border-amber-200/60 bg-amber-50/40",
                    )}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                        SOP delivery timer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <TaskSlaTimer sla={displayTask.sla} />
                      {displayTask.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          Deadline:{" "}
                          {new Date(displayTask.dueDate).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

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
                  <Alert>
                    <AlertDescription>
                      Revision round {displayTask.revisionRound}
                      {displayTask.revisionRound > 2 ? " — billable per SOP" : " — included in fee"}
                    </AlertDescription>
                  </Alert>
                )}

                {displayTask.billableRevisionPending && (
                  <Alert variant="destructive">
                    <AlertDescription className="space-y-2">
                      <p>
                        Round {displayTask.revisionRound} exceeds the 2 included revisions. Quote and
                        bill before resuming client review.
                      </p>
                      {canAckBillable && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => billableAckMutation.mutate()}
                          disabled={billableAckMutation.isPending}
                        >
                          Acknowledge billable revision
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {mode === "view" && isBeforeClientReview && !displayTask.qaSignedOffAt && (
                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertDescription className="space-y-2">
                      <p>Peer QA sign-off required before this task can move to client review.</p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => qaSignoffMutation.mutate()}
                        disabled={qaSignoffMutation.isPending}
                      >
                        {qaSignoffMutation.isPending ? "Signing off..." : "Sign off internal QA"}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {displayTask.qaSignedOffAt && displayTask.qaSignedOffBy && (
                  <Alert className="border-green-200/60 bg-green-50/40">
                    <CheckCircle2 className="h-4 w-4 text-green-700" />
                    <AlertDescription className="text-green-900">
                      QA signed off by {displayTask.qaSignedOffBy.name} on{" "}
                      {new Date(displayTask.qaSignedOffAt).toLocaleDateString()}
                    </AlertDescription>
                  </Alert>
                )}

                {displayTask.clientApprovedAt && (
                  <Alert className="border-green-200/60 bg-green-50/40">
                    <CheckCircle2 className="h-4 w-4 text-green-700" />
                    <AlertDescription className="text-green-900">
                      Client approved {new Date(displayTask.clientApprovedAt).toLocaleDateString()}
                    </AlertDescription>
                  </Alert>
                )}

                {displayTask.customFields && Object.keys(displayTask.customFields).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Delivery details
                    </p>
                    {Object.entries(displayTask.customFields).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">{customFieldLabels[key] || key}</span>
                        <span className="text-right font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {displayTask.createdAt && (
                  <div className="flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
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

        <SheetFooter className="border-t px-5 py-4">
          {editing && canEdit ? (
            <div className="flex w-full gap-2">
              {mode === "view" && (
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                form="task-form"
                className="flex-1"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Save className="h-4 w-4" />
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : mode === "create"
                    ? "Create task"
                    : "Save changes"}
              </Button>
            </div>
          ) : canEdit && mode === "view" ? (
            <Button type="button" variant="outline" className="w-full" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              Edit task
            </Button>
          ) : (
            <p className="w-full text-center text-xs text-muted-foreground">
              Only managers can create or edit tasks. Drag cards to update status.
            </p>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
    <Card className={cn(highlight && "border-destructive/30 bg-destructive/5")}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p className={cn("mt-1 text-sm font-medium", highlight && "text-destructive")}>{value}</p>
      </CardContent>
    </Card>
  );
}
