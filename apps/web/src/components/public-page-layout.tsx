export function PublicPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mesh-page min-h-screen py-10">
      <div className="mx-auto max-w-[800px] px-4">{children}</div>
    </div>
  );
}

export function PublicLoadingState({ message }: { message: string }) {
  return (
    <div className="mesh-page flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function PublicErrorState({ message }: { message: string }) {
  return (
    <div className="mesh-page flex min-h-screen items-center justify-center">
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}
