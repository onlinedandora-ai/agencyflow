"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertCircle, Kanban, Lock, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { HEALTH_STYLES, type ProjectHealth } from "@/lib/task-utils";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  const token = useAuthStore((s) => s.token)!;

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects(token),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Projects</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          One confirmed project, many tasks — managers define work, assign owners, and set urgency.
          The board stays scannable; click any card for full details.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading projects...</p>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <Kanban className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No projects yet. Convert a won lead to create a client workspace and project.
            </p>
            <Link href="/clients" className="mt-4 text-sm text-primary hover:underline">
              View clients →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="card-grid-2 xl:grid-cols-3">
          {projects.map((project) => {
            const health = (project.health || "green") as ProjectHealth;
            const healthStyle = HEALTH_STYLES[health];

            return (
              <Link key={project.id} href={`/projects/${project.id}/board`} className="group block">
                <Card
                  className={cn(
                    "catalog-card transition hover:border-primary/30 hover:shadow-2xl",
                    project.isGateLocked && "border-amber-200/60",
                  )}
                >
                  <CardHeader className="p-0 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-sm leading-snug group-hover:text-primary sm:text-base">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-1 text-xs sm:text-sm">
                          {project.workspace.company}
                        </CardDescription>
                      </div>
                      {project.isGateLocked ? (
                        <Lock className="h-4 w-4 shrink-0 text-amber-600" />
                      ) : (
                        <Unlock className="h-4 w-4 shrink-0 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Badge variant="secondary" className={healthStyle.bg}>
                        {healthStyle.label}
                      </Badge>
                      <Badge variant="outline">{project.serviceLine}</Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col justify-end space-y-2 p-0">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {project.completedCount ?? 0} of {project.taskCount} delivered
                        </span>
                        <span>{project.progressPercent ?? 0}%</span>
                      </div>
                      <Progress value={project.progressPercent ?? 0} />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {(project.overdueCount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 font-medium text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {project.overdueCount} overdue
                        </span>
                      )}
                      {(project.urgentCount ?? 0) > 0 && (
                        <span className="font-medium text-amber-700">{project.urgentCount} urgent</span>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="p-0 pt-2">
                    <span className="text-xs text-primary sm:text-sm">Open board →</span>
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
