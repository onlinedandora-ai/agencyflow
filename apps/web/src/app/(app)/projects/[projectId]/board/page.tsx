"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, GripVertical, Lock, Plus } from "lucide-react";
import { TaskDetailDrawer } from "@/components/task-detail-drawer";
import { api, cn, type BoardColumnData, type TaskItem } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  canManageTasks,
  formatDueCountdown,
  HEALTH_STYLES,
  isOverdue,
  normalizePriority,
  PRIORITY_STYLES,
  type ProjectHealth,
} from "@/lib/task-utils";

function CompactTaskCard({
  task,
  doneColumnKey,
  isDragging,
  onOpen,
  dragHandleProps,
}: {
  task: TaskItem;
  doneColumnKey: string;
  isDragging?: boolean;
  onOpen: (task: TaskItem) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const priority = normalizePriority(task.priority);
  const priorityStyle = PRIORITY_STYLES[priority];
  const overdue = isOverdue(task.dueDate, task.boardColumn, doneColumnKey);
  const dueLabel = formatDueCountdown(task.dueDate);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-sm transition hover:border-[var(--color-primary)]",
        isDragging && "opacity-50 ring-2 ring-[var(--color-primary)]",
        task.isBlockedByGate && "border-amber-200 bg-amber-50/40",
      )}
    >
      <div className={cn("h-1", priorityStyle.bar)} />
      <div className="flex items-stretch">
        <button
          type="button"
          className="flex cursor-grab items-center px-1.5 text-[var(--color-muted)] active:cursor-grabbing"
          aria-label="Drag task"
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="min-w-0 flex-1 px-2 py-2.5 text-left"
        >
          <div className="flex items-start gap-2">
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", priorityStyle.dot)} />
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-sm font-medium leading-snug">{task.title}</h3>
              {dueLabel && (
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    overdue ? "font-medium text-red-600" : "text-[var(--color-muted)]",
                  )}
                >
                  {dueLabel}
                </p>
              )}
            </div>
          </div>
        </button>
      </div>
    </article>
  );
}

function DraggableTaskCard({
  task,
  doneColumnKey,
  onOpen,
}: {
  task: TaskItem;
  doneColumnKey: string;
  onOpen: (task: TaskItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div ref={setNodeRef} style={style}>
      <CompactTaskCard
        task={task}
        doneColumnKey={doneColumnKey}
        isDragging={isDragging}
        onOpen={onOpen}
        dragHandleProps={{ ...listeners, ...attributes }}
      />
    </div>
  );
}

function BoardColumn({
  column,
  isGateLocked,
  firstColumnKey,
  doneColumnKey,
  onOpenTask,
}: {
  column: BoardColumnData;
  isGateLocked: boolean;
  firstColumnKey: string;
  doneColumnKey: string;
  onOpenTask: (task: TaskItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  const isLockedColumn = isGateLocked && column.key !== firstColumnKey;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-h-[480px] min-w-[200px] flex-1 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 transition-colors",
        isOver && !isLockedColumn && "border-[var(--color-primary)] bg-indigo-50/50",
        isLockedColumn && "opacity-60",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="truncate text-xs font-semibold uppercase tracking-wide">{column.label}</h2>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs text-[var(--color-muted)]">
          {column.tasks.length}
        </span>
      </div>
      {isLockedColumn && (
        <p className="mb-2 flex items-center gap-1 text-[10px] text-amber-700">
          <Lock className="h-3 w-3" />
          Locked until advance paid
        </p>
      )}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {column.tasks.map((task) => (
          <DraggableTaskCard
            key={task.id}
            task={task}
            doneColumnKey={doneColumnKey}
            onOpen={onOpenTask}
          />
        ))}
      </div>
    </section>
  );
}

export default function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const token = useAuthStore((s) => s.token)!;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [dragTask, setDragTask] = useState<TaskItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "view">("view");
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const canManage = canManageTasks(user?.role);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: board, isLoading } = useQuery({
    queryKey: ["project-board", projectId],
    queryFn: () => api.getProjectBoard(token, projectId),
  });

  const moveMutation = useMutation({
    mutationFn: ({ taskId, boardColumn }: { taskId: string; boardColumn: string }) =>
      api.moveTask(token, taskId, boardColumn),
    onSuccess: () => {
      setMoveError(null);
      queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
    },
    onError: (err: Error) => {
      setMoveError(err.message);
      queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
    },
  });

  function openCreate() {
    setSelectedTask(null);
    setDrawerMode("create");
    setDrawerOpen(true);
  }

  function openTask(task: TaskItem) {
    setSelectedTask(task);
    setDrawerMode("view");
    setDrawerOpen(true);
  }

  function handleDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task as TaskItem | undefined;
    setDragTask(task ?? null);
    setMoveError(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragTask(null);
    const taskId = String(event.active.id);
    const overId = event.over?.id;
    if (!overId || !board) return;

    const newColumn = String(overId);
    const columnKeys = board.columns.map((col) => col.key);
    if (!columnKeys.includes(newColumn)) return;

    const currentTask = board.columns.flatMap((col) => col.tasks).find((t) => t.id === taskId);
    if (!currentTask || currentTask.boardColumn === newColumn) return;

    queryClient.setQueryData<typeof board>(["project-board", projectId], (old) => {
      if (!old) return old;
      return {
        ...old,
        columns: old.columns.map((col) => ({
          ...col,
          tasks:
            col.key === currentTask.boardColumn
              ? col.tasks.filter((t) => t.id !== taskId)
              : col.key === newColumn
                ? [...col.tasks, { ...currentTask, boardColumn: newColumn }]
                : col.tasks,
        })),
      };
    });

    moveMutation.mutate({ taskId, boardColumn: newColumn });
  }

  if (isLoading || !board) {
    return <p className="text-sm text-[var(--color-muted)]">Loading board...</p>;
  }

  const firstColumnKey = board.columns[0]?.key ?? "";
  const doneColumnKey = board.columns[board.columns.length - 1]?.key ?? "";
  const customFieldLabels = board.template.customFieldLabels;
  const health = (board.health || "green") as ProjectHealth;
  const healthStyle = HEALTH_STYLES[health];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <Link href="/projects" className="mt-1 text-[var(--color-muted)] hover:text-[var(--color-primary)]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{board.projectName}</h1>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", healthStyle.bg)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", healthStyle.dot)} />
              {healthStyle.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {board.workspace.company} · {board.serviceLine}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
            <span>{board.progressPercent ?? 0}% delivered</span>
            {(board.overdueCount ?? 0) > 0 && (
              <span className="font-medium text-red-600">{board.overdueCount} overdue</span>
            )}
            {(board.urgentCount ?? 0) > 0 && (
              <span className="font-medium text-amber-700">{board.urgentCount} urgent</span>
            )}
          </div>
          <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-[var(--color-bg)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${board.progressPercent ?? 0}%` }}
            />
          </div>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            Define task
          </button>
        )}
      </div>

      {board.isGateLocked && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <strong>Advance payment gate active.</strong> New work stays in the first column until advance is
            confirmed on the{" "}
            <Link href="/clients" className="underline">
              Clients
            </Link>{" "}
            page. Managers can still define and assign tasks.
          </div>
        </div>
      )}

      {!canManage && (
        <p className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-muted)]">
          Click a task to see your assignment and timeline. Drag cards to update status.
        </p>
      )}

      {moveError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {moveError}
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {board.columns.map((column) => (
            <BoardColumn
              key={column.key}
              column={column}
              isGateLocked={board.isGateLocked}
              firstColumnKey={firstColumnKey}
              doneColumnKey={doneColumnKey}
              onOpenTask={openTask}
            />
          ))}
        </div>

        <DragOverlay>
          {dragTask ? (
            <div className="w-[200px] rotate-1 shadow-lg">
              <CompactTaskCard task={dragTask} doneColumnKey={doneColumnKey} onOpen={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDetailDrawer
        open={drawerOpen}
        mode={drawerMode}
        task={selectedTask}
        projectId={projectId}
        token={token}
        userRole={user?.role || ""}
        customFieldLabels={customFieldLabels}
        doneColumnKey={doneColumnKey}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
