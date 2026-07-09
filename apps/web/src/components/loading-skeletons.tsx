import { cn } from "@/lib/utils";

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function AppLayoutSkeleton() {
  return (
    <div className="mesh-page flex min-h-screen">
      <aside className="glass-sidebar hidden w-64 shrink-0 flex-col lg:flex">
        <div className="border-b border-white/10 px-6 py-5">
          <Pulse className="h-6 w-32" />
          <Pulse className="mt-2 h-3 w-24 bg-muted/70" />
        </div>
        <div className="flex-1 space-y-2 p-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Pulse key={i} className="h-9 w-full bg-white/10" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-header flex items-center gap-3 px-6 py-4">
          <Pulse className="h-9 w-9 rounded-lg lg:hidden" />
          <div className="min-w-0 flex-1 space-y-2">
            <Pulse className="h-3 w-20 bg-muted/70" />
            <Pulse className="h-5 w-36" />
          </div>
          <Pulse className="h-9 w-20 rounded-lg" />
        </header>
        <main className="flex-1 p-6">
          <Pulse className="h-8 w-48" />
          <Pulse className="mt-3 h-4 w-72 max-w-full bg-muted/70" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="stat-tile space-y-3">
                <Pulse className="h-4 w-24 bg-muted/70" />
                <Pulse className="h-8 w-16" />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export function StatTilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="card-grid-stats">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-tile space-y-3">
          <Pulse className="h-4 w-28 bg-muted/70" />
          <Pulse className="h-8 w-14" />
        </div>
      ))}
    </div>
  );
}

export function ProjectCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="card-grid-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="catalog-card space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Pulse className="h-5 w-3/4" />
              <Pulse className="h-4 w-1/2 bg-muted/70" />
            </div>
            <Pulse className="h-4 w-4 rounded bg-muted/70" />
          </div>
          <div className="flex gap-2">
            <Pulse className="h-5 w-16 rounded-full bg-muted/70" />
            <Pulse className="h-5 w-20 rounded-full bg-muted/70" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Pulse className="h-3 w-24 bg-muted/60" />
              <Pulse className="h-3 w-8 bg-muted/60" />
            </div>
            <Pulse className="h-2 w-full rounded-full bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function KanbanBoardSkeleton() {
  return (
    <>
      <div className="hidden gap-3 md:grid md:grid-cols-4 2xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <section key={i} className="glass-panel flex min-h-[280px] flex-col p-3">
            <div className="mb-3 flex items-center justify-between">
              <Pulse className="h-4 w-20 bg-muted/70" />
              <Pulse className="h-5 w-6 rounded-full bg-muted/60" />
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: i % 3 === 0 ? 2 : 1 }).map((__, j) => (
                <div key={j} className="glass-panel h-24 animate-pulse bg-muted/25" />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="space-y-3 md:hidden">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Pulse key={i} className="h-8 w-20 shrink-0 rounded-full bg-muted/70" />
          ))}
        </div>
        <div className="mobile-stack space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stack-card h-28 animate-pulse bg-muted/25" />
          ))}
        </div>
      </div>
    </>
  );
}

export function PipelineSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Pulse className="h-8 w-40" />
          <Pulse className="h-4 w-64 max-w-full bg-muted/70" />
        </div>
        <div className="flex gap-2">
          <Pulse className="h-10 w-28 rounded-lg" />
          <Pulse className="h-10 w-28 rounded-lg" />
        </div>
      </div>
      <StatTilesSkeleton />
      <KanbanBoardSkeleton />
    </div>
  );
}

export function WorkspaceListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-panel space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <div className="space-y-2">
              <Pulse className="h-6 w-48" />
              <Pulse className="h-4 w-32 bg-muted/70" />
              <Pulse className="h-4 w-56 bg-muted/70" />
            </div>
            <Pulse className="h-5 w-28 bg-muted/70" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((__, j) => (
              <Pulse key={j} className="h-6 w-24 rounded-full bg-muted/60" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoginRedirectSkeleton() {
  return (
    <div className="mesh-page flex min-h-screen items-center justify-center">
      <div className="glass-panel-strong w-full max-w-md space-y-4 border-white/60 p-8 text-center">
        <Pulse className="mx-auto h-10 w-10 rounded-full" />
        <Pulse className="mx-auto h-6 w-40" />
        <Pulse className="mx-auto h-4 w-56 bg-muted/70" />
      </div>
    </div>
  );
}
