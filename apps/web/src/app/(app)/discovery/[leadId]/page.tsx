"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api, DISCOVERY_QUESTIONS } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function DiscoveryPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const token = useAuthStore((s) => s.token)!;
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [researchNotes, setResearchNotes] = useState("");
  const [callNotes, setCallNotes] = useState("");

  const { data: discovery, isLoading } = useQuery({
    queryKey: ["discovery", leadId],
    queryFn: () => api.getDiscovery(token, leadId),
  });

  useEffect(() => {
    if (discovery) {
      setResearchNotes(discovery.researchNotes || "");
      setCallNotes(discovery.callNotes || "");
      setAnswers((discovery.answers as Record<string, string>) || {});
    }
  }, [discovery]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.upsertDiscovery(token, leadId, {
        researchNotes,
        callNotes,
        answers,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discovery", leadId] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pipeline" className="text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Discovery Call — {discovery?.lead?.name}</h1>
          <p className="text-sm text-muted-foreground">10-question structured discovery sheet (SOP-02)</p>
        </div>
        <Link href={`/proposals/${leadId}`} className="text-sm text-primary">
          Build proposal →
        </Link>
      </div>

      <div className="glass-panel p-4">
        <label className="mb-2 block text-sm font-medium">Pre-call research notes</label>
        <textarea
          value={researchNotes}
          onChange={(e) => setResearchNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-4">
        {DISCOVERY_QUESTIONS.map((question, i) => (
          <div key={i} className="glass-panel p-4">
            <label className="mb-2 block text-sm font-medium">
              {i + 1}. {question}
            </label>
            <textarea
              value={answers[`q${i + 1}`] || ""}
              onChange={(e) => setAnswers({ ...answers, [`q${i + 1}`]: e.target.value })}
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      <div className="glass-panel p-4">
        <label className="mb-2 block text-sm font-medium">Call notes</label>
        <textarea
          value={callNotes}
          onChange={(e) => setCallNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
      >
        {saveMutation.isPending ? "Saving..." : "Save discovery sheet"}
      </button>
    </div>
  );
}
