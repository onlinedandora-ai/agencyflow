"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertCircle, Kanban, Lock, Unlock } from "lucide-react";
import { api, cn } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { HEALTH_STYLES, type ProjectHealth } from "@/lib/task-utils";

export default function ProjectsPage() {
  const token = useAuthStore((s) => s.token)!;

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects(token),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Projects</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">
          One confirmed project, many tasks — managers define work, assign owners, and set urgency.
          The board stays scannable; click any card for full details.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading projects...</p>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-8 text-center">
          <Kanban className="mx-auto h-8 w-8 text-[var(--color-muted)]" />
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            No projects yet. Convert a won lead to create a client workspace and project.
          </p>
          <Link href="/clients" className="mt-4 inline-block text-sm text-[var(--color-primary)]">
            View clients →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const health = (project.health || "green") as ProjectHealth;
            const healthStyle = HEALTH_STYLES[health];

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}/board`}
                className={cn(
                  "group rounded-xl border bg-white p-5 transition hover:border-[var(--color-primary)] hover:shadow-sm",
                  project.isGateLocked ? "border-amber-200" : "border-[var(--color-border)]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-semibold group-hover:text-[var(--color-primary)]">{project.name}</h2>
                    <p className="text-sm text-[var(--color-muted)]">{project.workspace.company}</p>
                  </div>
                  {project.isGateLocked ? (
                    <Lock className="h-4 w-4 shrink-0 text-[var(--color-warning)]" />
                  ) : (
                    <Unlock className="h-4 w-4 shrink-0 text-[var(--color-success)]" />
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", healthStyle.bg)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", healthStyle.dot)} />
                    {healthStyle.label}
                  </span>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-[var(--color-primary)]">
                    {project.serviceLine}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-[var(--color-muted)]">
                    <span>{project.completedCount ?? 0} of {project.taskCount} delivered</span>
                    <span>{project.progressPercent ?? 0}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary)]"
                      style={{ width: `${project.progressPercent ?? 0}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
                  {(project.overdueCount ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 font-medium text-red-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {project.overdueCount} overdue
                    </span>
                  )}
                  {(project.urgentCount ?? 0) > 0 && (
                    <span className="font-medium text-amber-700">{project.urgentCount} urgent</span>
                  )}
                  {project.team && project.team.length > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="flex -space-x-1.5">
                        {project.team.slice(0, 3).map((member) => (
                          <span
                            key={member.id}
                            title={member.name}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-indigo-100 text-[10px] font-semibold text-[var(--color-primary)]"
                          >
                            {member.name
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)}
                          </span>
                        ))}
                      </div>
                      {project.team.length > 3 && <span>+{project.team.length - 3}</span>}
                    </div>
                  )}
                </div>

                <p className="mt-4 text-sm text-[var(--color-primary)]">Open board →</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
