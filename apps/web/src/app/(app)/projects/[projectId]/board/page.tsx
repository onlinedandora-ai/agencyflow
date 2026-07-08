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
import { TaskSlaTimer } from "@/components/task-sla-timer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api, type BoardColumnData, type TaskItem } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  canManageTasks,
  HEALTH_STYLES,
  normalizePriority,
  PRIORITY_STYLES,
  type ProjectHealth,
} from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import { MobileStageSelect, StageChipBar } from "@/components/mobile-stage-picker";

function CompactTaskCard({
  task,
  doneColumnKey,
  isDragging,
  onOpen,
  dragHandleProps,
  mobile = false,
  columnOptions,
  onMoveColumn,
}: {
  task: TaskItem;
  doneColumnKey: string;
  isDragging?: boolean;
  onOpen: (task: TaskItem) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  mobile?: boolean;
  columnOptions?: Array<{ id: string; label: string }>;
  onMoveColumn?: (taskId: string, columnKey: string) => void;
}) {
  const priority = normalizePriority(task.priority);
  const priorityStyle = PRIORITY_STYLES[priority];

  return (
    <article
      className={cn(
        mobile ? "stack-card overflow-hidden p-0" : "glass-panel overflow-hidden p-0",
        "transition hover:border-primary/30",
        isDragging && "opacity-50 ring-2 ring-primary",
        task.isBlockedByGate && "border-amber-200/70",
        task.sla?.breached && "border-destructive/40",
      )}
    >
      <div className={cn("h-1", priorityStyle.bar)} />
      <div className="flex items-stretch">
        {!mobile && (
          <button
            type="button"
            className="flex cursor-grab items-center px-1.5 text-muted-foreground active:cursor-grabbing"
            aria-label="Drag task"
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="min-w-0 flex-1 px-3 py-3 text-left sm:px-2 sm:py-2.5"
        >
          <div className="flex items-start gap-2">
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", priorityStyle.dot)} />
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-sm font-medium leading-snug">{task.title}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <TaskSlaTimer sla={task.sla} compact />
                {task.revisionRound > 0 && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    R{task.revisionRound}
                  </span>
                )}
                {task.billableRevisionPending && (
                  <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                    Billable
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>
      </div>
      {mobile && columnOptions && onMoveColumn && (
        <div className="border-t border-white/30 px-3 pb-3">
          <MobileStageSelect
            value={task.boardColumn}
            label="Move to column"
            options={columnOptions}
            onChange={(columnKey) => onMoveColumn(task.id, columnKey)}
          />
        </div>
      )}
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
        "glass-panel flex min-h-[480px] min-w-[200px] flex-1 flex-col p-3 transition-colors",
        isOver && !isLockedColumn && "border-primary/40 bg-white/70",
        isLockedColumn && "opacity-60",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="truncate text-xs font-semibold uppercase tracking-wide">{column.label}</h2>
        <span className="glass-badge shrink-0">
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
  const [moveError, setMoveError] = useState<{ message: string; taskId?: string } | null>(null);
  const [mobileColumn, setMobileColumn] = useState<string | null>(null);

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
    onError: (err: Error, variables) => {
      setMoveError({ message: err.message, taskId: variables.taskId });
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
    moveTaskToColumn(taskId, String(overId));
  }

  function moveTaskToColumn(taskId: string, newColumn: string) {
    if (!board) return;

    const columnKeys = board.columns.map((col) => col.key);
    if (!columnKeys.includes(newColumn)) return;

    const currentTask = board.columns.flatMap((col) => col.tasks).find((t) => t.id === taskId);
    if (!currentTask || currentTask.boardColumn === newColumn) return;

    const targetColumn = board.columns.find((col) => col.key === newColumn);
    if (targetColumn?.status === "CLIENT_REVIEW") {
      if (!currentTask.qaSignedOffAt) {
        setMoveError({
          message:
            "Peer QA sign-off is required before client review. Open the task and click “Sign off internal QA” (must be someone other than the assignee).",
          taskId,
        });
        return;
      }
      if (currentTask.billableRevisionPending) {
        setMoveError({
          message:
            "Revision round 3+ is billable — a manager must acknowledge before this task returns to client review.",
          taskId,
        });
        return;
      }
    }

    setMoveError(null);

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
    setMobileColumn(newColumn);
  }

  if (isLoading || !board) {
    return <p className="text-sm text-muted-foreground">Loading board...</p>;
  }

  const firstColumnKey = board.columns[0]?.key ?? "";
  const doneColumnKey = board.columns[board.columns.length - 1]?.key ?? "";
  const customFieldLabels = board.template.customFieldLabels;
  const health = (board.health || "green") as ProjectHealth;
  const healthStyle = HEALTH_STYLES[health];
  const columnOptions = board.columns.map((col) => ({
    id: col.key,
    label: col.label,
    count: col.tasks.length,
  }));
  const activeMobileColumn =
    mobileColumn ?? board.columns.find((col) => col.tasks.length > 0)?.key ?? board.columns[0]?.key ?? "";
  const mobileTasks = board.columns.find((col) => col.key === activeMobileColumn)?.tasks ?? [];
  const mobileColumnMeta = board.columns.find((col) => col.key === activeMobileColumn);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <Link href="/projects" className="mt-1 text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold sm:text-2xl">{board.projectName}</h1>
            <Badge variant="secondary" className={healthStyle.bg}>
              {healthStyle.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {board.workspace.company} · {board.serviceLine}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{board.progressPercent ?? 0}% delivered</span>
            {(board.overdueCount ?? 0) > 0 && (
              <span className="font-medium text-destructive">{board.overdueCount} overdue</span>
            )}
            {(board.slaBreaches ?? 0) > 0 && (
              <span className="font-medium text-destructive">{board.slaBreaches} SLA breach</span>
            )}
            {(board.urgentCount ?? 0) > 0 && (
              <span className="font-medium text-amber-700">{board.urgentCount} urgent</span>
            )}
          </div>
          <Progress value={board.progressPercent ?? 0} className="mt-2 max-w-xs" />
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Define task
          </Button>
        )}
      </div>

      {board.isGateLocked && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Advance payment gate active</AlertTitle>
          <AlertDescription>
            New work stays in the first column until advance is confirmed on the{" "}
            <Link href="/clients" className="underline">
              Clients
            </Link>{" "}
            page. Managers can still define and assign tasks.
          </AlertDescription>
        </Alert>
      )}

      {!canManage && (
        <Alert>
          <AlertDescription>
            <span className="hidden md:inline">Click a task to see your assignment and timeline. Drag cards to update status.</span>
            <span className="md:hidden">Tap a column chip, open a task, or use Move to column to update status.</span>
          </AlertDescription>
        </Alert>
      )}

      {moveError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not move task</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{moveError.message}</p>
            {moveError.taskId && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-destructive/30 bg-white/80"
                onClick={() => {
                  const task = board.columns
                    .flatMap((col) => col.tasks)
                    .find((t) => t.id === moveError.taskId);
                  if (task) openTask(task);
                }}
              >
                Open task
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Mobile: stage chips + stacked full-width task cards */}
      <div className="space-y-4 md:hidden">
        <StageChipBar
          stages={columnOptions}
          activeId={activeMobileColumn}
          onChange={setMobileColumn}
        />
        {mobileColumnMeta && board.isGateLocked && mobileColumnMeta.key !== firstColumnKey && (
          <p className="flex items-center gap-1 text-xs text-amber-700">
            <Lock className="h-3.5 w-3.5" />
            Locked until advance paid — tasks stay in the first column
          </p>
        )}
        <div className="mobile-stack">
          {mobileTasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/50 bg-white/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No tasks in {mobileColumnMeta?.label || "this column"}
            </p>
          ) : (
            mobileTasks.map((task) => (
              <CompactTaskCard
                key={task.id}
                task={task}
                doneColumnKey={doneColumnKey}
                mobile
                onOpen={openTask}
                columnOptions={board.columns.map((col) => ({ id: col.key, label: col.label }))}
                onMoveColumn={moveTaskToColumn}
              />
            ))
          )}
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="hidden gap-3 md:flex">
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
