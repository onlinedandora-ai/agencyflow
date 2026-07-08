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
import { AlertTriangle, Archive, Briefcase, Clock, GripVertical, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LeadEditDialog } from "@/components/lead-edit-dialog";
import { NewWorkOnboardingDialog } from "@/components/new-work-onboarding-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api, cn, type Lead, type PipelineColumn } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { canManageTasks } from "@/lib/task-utils";
import { MobileStageSelect, StageChipBar } from "@/components/mobile-stage-picker";

type DragHandleProps = React.HTMLAttributes<HTMLButtonElement>;

const PIPELINE_STAGES = [
  "NEW",
  "CONTACTED",
  "DISCOVERY_SCHEDULED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
  "NURTURE",
] as const;

const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  DISCOVERY_SCHEDULED: "Discovery",
  PROPOSAL_SENT: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Won",
  CLOSED_LOST: "Lost",
  NURTURE: "Nurture",
};

function LeadCardContent({
  lead,
  onRespond,
  onConvert,
  onStageChange,
  onEdit,
  onArchive,
  canManage,
  isConverted,
  isConverting,
  dragHandleProps,
  isDragging,
  mobile = false,
}: {
  lead: Lead;
  onRespond: (id: string) => void;
  onConvert: (id: string) => void;
  onStageChange?: (id: string, stage: string) => void;
  onEdit?: (lead: Lead) => void;
  onArchive?: (id: string) => void;
  canManage?: boolean;
  isConverted?: boolean;
  isConverting?: boolean;
  dragHandleProps?: DragHandleProps;
  isDragging?: boolean;
  mobile?: boolean;
}) {
  const slaClass = lead.sla.breached
    ? "text-destructive"
    : lead.sla.remainingMinutes <= 10 && !lead.sla.responded
      ? "text-amber-600"
      : "text-muted-foreground";

  return (
    <article
      className={cn(
        mobile ? "stack-card" : "glass-panel p-3",
        isDragging && "opacity-50 ring-2 ring-primary",
      )}
    >
      <div className="flex items-start gap-2">
        {!mobile && (
          <button
            type="button"
            className="mt-0.5 flex cursor-grab items-center text-muted-foreground active:cursor-grabbing"
            aria-label="Drag lead"
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4 shrink-0" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="truncate font-medium">{lead.name}</h3>
              <p className="truncate text-xs text-muted-foreground">{lead.company || "No company"}</p>
            </div>
            {lead.sla.breached && !lead.sla.responded && (
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            )}
          </div>

          <div className={cn("mt-2 flex items-center gap-1 text-xs", slaClass)}>
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {lead.sla.responded
                ? "First response logged"
                : `${lead.sla.remainingMinutes}m left (30m SLA)`}
            </span>
          </div>

          {!lead.sla.responded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRespond(lead.id);
              }}
              className="mt-3 rounded-md bg-[var(--color-primary)] px-2 py-1 text-xs text-white"
            >
              Log response
            </button>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/discovery/${lead.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:underline"
            >
              Discovery
            </Link>
            <Link
              href={`/proposals/${lead.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:underline"
            >
              Proposal
            </Link>
            {canManage && onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(lead);
                }}
                className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
            {canManage && onArchive && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(lead.id);
                }}
                className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-destructive"
              >
                <Archive className="h-3 w-3" />
                Archive
              </button>
            )}
          </div>

          {(lead.stage === "NEGOTIATION" || lead.stage === "CLOSED_WON") &&
            (isConverted ? (
              <Link
                href="/clients"
                onClick={(e) => e.stopPropagation()}
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                View client workspace
              </Link>
            ) : (
              <button
                type="button"
                disabled={isConverting}
                onClick={(e) => {
                  e.stopPropagation();
                  onConvert(lead.id);
                }}
                className="mt-2 rounded-md border border-[var(--color-primary)] px-2 py-1 text-xs text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConverting ? "Converting…" : "Convert to client"}
              </button>
            ))}

          {mobile && onStageChange && (
            <MobileStageSelect
              value={lead.stage}
              options={PIPELINE_STAGES.map((s) => ({ id: s, label: STAGE_LABELS[s] || s }))}
              onChange={(stage) => onStageChange(lead.id, stage)}
            />
          )}
        </div>
      </div>
    </article>
  );
}

function DraggableLeadCard({
  lead,
  onRespond,
  onConvert,
  onEdit,
  onArchive,
  canManage,
  isConverted,
  convertingLeadId,
}: {
  lead: Lead;
  onRespond: (id: string) => void;
  onConvert: (id: string) => void;
  onEdit: (lead: Lead) => void;
  onArchive: (id: string) => void;
  canManage: boolean;
  isConverted: boolean;
  convertingLeadId: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div ref={setNodeRef} style={style}>
      <LeadCardContent
        lead={lead}
        onRespond={onRespond}
        onConvert={onConvert}
        onEdit={onEdit}
        onArchive={onArchive}
        canManage={canManage}
        isConverted={isConverted}
        isConverting={convertingLeadId === lead.id}
        dragHandleProps={{ ...listeners, ...attributes }}
        isDragging={isDragging}
      />
    </div>
  );
}

function PipelineColumn({
  stage,
  leads,
  onRespond,
  onConvert,
  onEdit,
  onArchive,
  canManage,
  convertedLeadIds,
  convertingLeadId,
}: {
  stage: string;
  leads: Lead[];
  onRespond: (id: string) => void;
  onConvert: (id: string) => void;
  onEdit: (lead: Lead) => void;
  onArchive: (id: string) => void;
  canManage: boolean;
  convertedLeadIds: Set<string>;
  convertingLeadId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "glass-panel flex min-h-[300px] min-w-0 flex-col p-3 transition-colors sm:min-h-[420px]",
        isOver && "border-primary/40 bg-white/70",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="truncate text-xs font-semibold uppercase tracking-wide">
          {STAGE_LABELS[stage] || stage}
        </h2>
        <span className="glass-badge shrink-0">
          {leads.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {leads.map((lead) => (
          <DraggableLeadCard
            key={lead.id}
            lead={lead}
            onRespond={onRespond}
            onConvert={onConvert}
            onEdit={onEdit}
            onArchive={onArchive}
            canManage={canManage}
            isConverted={convertedLeadIds.has(lead.id)}
            convertingLeadId={convertingLeadId}
          />
        ))}
      </div>
    </section>
  );
}

function normalizePipeline(columns: PipelineColumn[]): PipelineColumn[] {
  const leadById = new Map<string, Lead>();
  for (const col of columns) {
    for (const lead of col.leads) {
      if (!leadById.has(lead.id)) leadById.set(lead.id, lead);
    }
  }
  const allLeads = Array.from(leadById.values());
  return PIPELINE_STAGES.map((stage) => ({
    stage,
    leads: allLeads.filter((l) => l.stage === stage),
  }));
}

export default function PipelinePage() {
  const token = useAuthStore((s) => s.token)!;
  const user = useAuthStore((s) => s.user);
  const isManager = canManageTasks(user?.role);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showNewWork, setShowNewWork] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [mobileStage, setMobileStage] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company: "", source: "MANUAL" });
  const [createError, setCreateError] = useState("");
  const [convertFeedback, setConvertFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const { data: pipeline = [], isLoading } = useQuery({
    queryKey: ["pipeline"],
    queryFn: () => api.getPipeline(token),
    select: normalizePipeline,
  });

  const { data: stats } = useQuery({
    queryKey: ["pipeline-stats"],
    queryFn: () => api.getStats(token),
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.getWorkspaces(token),
  });

  const convertedLeadIds = new Set(
    workspaces.map((ws) => ws.leadId).filter((id): id is string => Boolean(id)),
  );

  const respondMutation = useMutation({
    mutationFn: (id: string) => api.logFirstResponse(token, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      api.updateLead(token, id, { stage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
    onError: () => queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
  });

  const convertMutation = useMutation({
    mutationFn: (leadId: string) => api.convertLead(token, leadId),
    onMutate: (leadId) => {
      setConvertingLeadId(leadId);
      setConvertFeedback(null);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setConvertFeedback({
        type: "success",
        message: result.alreadyConverted
          ? "This lead was already converted to a client workspace."
          : "Lead converted to client workspace successfully.",
      });
    },
    onError: (err: Error) => {
      setConvertFeedback({ type: "error", message: err.message });
    },
    onSettled: () => setConvertingLeadId(null),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createLead(token, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-stats"] });
      setShowForm(false);
      setForm({ name: "", email: "", company: "", source: "MANUAL" });
      setCreateError("");
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.archiveLead(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-stats"] });
      queryClient.invalidateQueries({ queryKey: ["leads-archive"] });
    },
  });

  function handleDragStart(event: DragStartEvent) {
    const lead = event.active.data.current?.lead as Lead | undefined;
    setActiveLead(lead ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null);

    const leadId = String(event.active.id);
    const overId = event.over?.id;
    if (!overId) return;

    const newStage = String(overId);
    if (!PIPELINE_STAGES.includes(newStage as (typeof PIPELINE_STAGES)[number])) return;

    const currentLead = pipeline.flatMap((col) => col.leads).find((lead) => lead.id === leadId);
    if (!currentLead || currentLead.stage === newStage) return;

    queryClient.setQueryData<PipelineColumn[]>(["pipeline"], (old) => {
      if (!old) return old;
      return old.map((col) => ({
        ...col,
        leads:
          col.stage === currentLead.stage
            ? col.leads.filter((lead) => lead.id !== leadId)
            : col.stage === newStage
              ? [...col.leads, { ...currentLead, stage: newStage }]
              : col.leads,
      }));
    });

    updateMutation.mutate({ id: leadId, stage: newStage });
  }

  function handleStageChange(leadId: string, newStage: string) {
    if (!PIPELINE_STAGES.includes(newStage as (typeof PIPELINE_STAGES)[number])) return;
    const currentLead = pipeline.flatMap((col) => col.leads).find((lead) => lead.id === leadId);
    if (!currentLead || currentLead.stage === newStage) return;

    queryClient.setQueryData<PipelineColumn[]>(["pipeline"], (old) => {
      if (!old) return old;
      return old.map((col) => ({
        ...col,
        leads:
          col.stage === currentLead.stage
            ? col.leads.filter((lead) => lead.id !== leadId)
            : col.stage === newStage
              ? [...col.leads, { ...currentLead, stage: newStage }]
              : col.leads,
      }));
    });

    updateMutation.mutate({ id: leadId, stage: newStage });
    setMobileStage(newStage);
  }

  const stageOptions = pipeline.map((col) => ({
    id: col.stage,
    label: STAGE_LABELS[col.stage] || col.stage,
    count: col.leads.length,
  }));
  const activeMobileStage =
    mobileStage ?? pipeline.find((col) => col.leads.length > 0)?.stage ?? PIPELINE_STAGES[0];
  const mobileLeads = pipeline.find((col) => col.stage === activeMobileStage)?.leads ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="page-title">Lead Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            <span className="hidden md:inline">Drag leads between columns to update their stage</span>
            <span className="md:hidden">Tap a stage, then use Move to update lead status</span>
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {isManager && (
            <Link
              href="/pipeline/archive"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/50 bg-white/40 px-4 py-2 text-sm font-medium backdrop-blur-md hover:bg-white/60"
            >
              <Archive className="h-4 w-4" />
              Archive
            </Link>
          )}
          {isManager && (
            <button
              type="button"
              onClick={() => setShowNewWork(true)}
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-white/50 bg-white/40 px-4 py-2 text-sm font-medium backdrop-blur-md hover:bg-white/60 sm:w-auto"
            >
              <Briefcase className="h-4 w-4" />
              Onboard existing client
            </button>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            New lead
          </button>
        </div>
      </div>

      {convertFeedback && (
        <Alert variant={convertFeedback.type === "error" ? "destructive" : "default"}>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{convertFeedback.message}</span>
            {convertFeedback.type === "success" && (
              <Link href="/clients" className="text-sm font-medium underline">
                View clients
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {stats && (
        <div className="card-grid-stats">
          {[
            ["Total leads", stats.total],
            ["Conversion", `${stats.conversionRate}%`],
            ["SLA breaches", stats.slaBreaches],
            ["Awaiting response", stats.awaitingFirstResponse],
          ].map(([label, value]) => (
            <div key={label} className="stat-tile">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="stat-value">{value}</p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (createMutation.isPending) return;
            createMutation.mutate();
          }}
          className="grid gap-3 glass-panel p-4 sm:grid-cols-2 md:grid-cols-4"
        >
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border px-3 py-2"
            required
          />
          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg border px-3 py-2"
          />
          <input
            placeholder="Company"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="rounded-lg border px-3 py-2"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-60"
          >
            {createMutation.isPending ? "Creating…" : "Create lead"}
          </button>
          {createError && (
            <p className="text-sm text-destructive sm:col-span-2 md:col-span-4">{createError}</p>
          )}
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading pipeline...</p>
      ) : (
        <>
          {/* Mobile: Zoho-style stage chips + vertical card stack */}
          <div className="space-y-4 md:hidden">
            <StageChipBar
              stages={stageOptions}
              activeId={activeMobileStage}
              onChange={setMobileStage}
            />
            <div className="mobile-stack">
              {mobileLeads.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/50 bg-white/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  No leads in {STAGE_LABELS[activeMobileStage] || activeMobileStage}
                </p>
              ) : (
                mobileLeads.map((lead) => (
                  <LeadCardContent
                    key={lead.id}
                    lead={lead}
                    mobile
                    canManage={isManager}
                    isConverted={convertedLeadIds.has(lead.id)}
                    isConverting={convertingLeadId === lead.id}
                    onRespond={(id) => respondMutation.mutate(id)}
                    onConvert={(id) => convertMutation.mutate(id)}
                    onStageChange={handleStageChange}
                    onEdit={setEditingLead}
                    onArchive={(id) => archiveMutation.mutate(id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Desktop: kanban with drag-and-drop */}
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="hidden gap-3 md:grid md:grid-cols-4 2xl:grid-cols-8">
              {pipeline.map((column) => (
                <PipelineColumn
                  key={column.stage}
                  stage={column.stage}
                  leads={column.leads}
                  canManage={isManager}
                  convertedLeadIds={convertedLeadIds}
                  convertingLeadId={convertingLeadId}
                  onRespond={(id) => respondMutation.mutate(id)}
                  onConvert={(id) => convertMutation.mutate(id)}
                  onEdit={setEditingLead}
                  onArchive={(id) => archiveMutation.mutate(id)}
                />
              ))}
            </div>

            <DragOverlay>
              {activeLead ? (
                <div className="rotate-1 shadow-lg">
                  <LeadCardContent lead={activeLead} onRespond={() => {}} onConvert={() => {}} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      <LeadEditDialog
        open={Boolean(editingLead)}
        lead={editingLead}
        token={token}
        onClose={() => setEditingLead(null)}
      />

      <NewWorkOnboardingDialog
        open={showNewWork}
        token={token}
        title="Onboard existing client"
        description="Attach new work to an existing client workspace without converting a lead."
        onClose={() => setShowNewWork(false)}
      />
    </div>
  );
}
