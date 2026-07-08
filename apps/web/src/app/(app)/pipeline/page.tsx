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
import { AlertTriangle, Clock, GripVertical, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api, cn, type Lead, type PipelineColumn } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

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
  isDragging,
}: {
  lead: Lead;
  onRespond: (id: string) => void;
  onConvert: (id: string) => void;
  isDragging?: boolean;
}) {
  const slaClass = lead.sla.breached
    ? "text-destructive"
    : lead.sla.remainingMinutes <= 10 && !lead.sla.responded
      ? "text-amber-600"
      : "text-muted-foreground";

  return (
    <article
      className={cn(
        "glass-panel p-3",
        isDragging && "opacity-50 ring-2 ring-primary",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
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
          </div>

          {(lead.stage === "NEGOTIATION" || lead.stage === "CLOSED_WON") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConvert(lead.id);
              }}
              className="mt-2 rounded-md border border-[var(--color-primary)] px-2 py-1 text-xs text-primary"
            >
              Convert to client
            </button>
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
}: {
  lead: Lead;
  onRespond: (id: string) => void;
  onConvert: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
      <LeadCardContent lead={lead} onRespond={onRespond} onConvert={onConvert} isDragging={isDragging} />
    </div>
  );
}

function PipelineColumn({
  stage,
  leads,
  onRespond,
  onConvert,
}: {
  stage: string;
  leads: Lead[];
  onRespond: (id: string) => void;
  onConvert: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "glass-panel flex min-h-[420px] min-w-0 flex-col p-3 transition-colors",
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
          <DraggableLeadCard key={lead.id} lead={lead} onRespond={onRespond} onConvert={onConvert} />
        ))}
      </div>
    </section>
  );
}

function normalizePipeline(columns: PipelineColumn[]): PipelineColumn[] {
  const byStage = new Map(columns.map((col) => [col.stage, col.leads]));
  return PIPELINE_STAGES.map((stage) => ({
    stage,
    leads: byStage.get(stage) ?? [],
  }));
}

export default function PipelinePage() {
  const token = useAuthStore((s) => s.token)!;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company: "", source: "MANUAL" });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.createLead(token, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      setShowForm(false);
      setForm({ name: "", email: "", company: "", source: "MANUAL" });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Lead Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Drag leads between columns to update their stage
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          New lead
        </button>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Total leads", stats.total],
            ["Conversion", `${stats.conversionRate}%`],
            ["SLA breaches", stats.slaBreaches],
            ["Awaiting response", stats.awaitingFirstResponse],
          ].map(([label, value]) => (
            <div key={label} className="glass-panel p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="grid gap-3 glass-panel p-4 md:grid-cols-4"
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
          <button type="submit" className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-white">
            Create lead
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading pipeline...</p>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-8">
            {pipeline.map((column) => (
              <PipelineColumn
                key={column.stage}
                stage={column.stage}
                leads={column.leads}
                onRespond={(id) => respondMutation.mutate(id)}
                onConvert={(id) => convertMutation.mutate(id)}
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
      )}
    </div>
  );
}
