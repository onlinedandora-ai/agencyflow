"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Briefcase,
  ChevronDown,
  FileText,
  Kanban,
  LayoutDashboard,
  Menu,
  Receipt,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { ROLE_LABELS } from "@/lib/task-utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const mainNavItems = [
  { href: "/pipeline", label: "Pipeline", icon: Users },
  { href: "/clients", label: "Clients", icon: Briefcase },
  { href: "/projects/list", label: "Projects", icon: Kanban },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const salesNavItems = [
  { href: "/proposals/list", label: "Proposals", icon: FileText },
  { href: "/invoices/list", label: "Invoices", icon: Receipt },
];

function SidebarBrand() {
  return (
    <div className="border-b border-white/10 px-5 py-4 lg:px-6 lg:py-5">
      <div className="text-lg font-semibold tracking-tight text-white">Dandora.online</div>
      <p className="mt-1 text-xs text-slate-300">by SreeDrisya Media</p>
    </div>
  );
}

function SidebarNav({
  pathname,
  salesOpen,
  setSalesOpen,
  salesActive,
  onNavigate,
}: {
  pathname: string;
  salesOpen: boolean;
  setSalesOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  salesActive: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-4">
      <div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setSalesOpen((v) => !v)}
          className={cn(
            "h-auto w-full justify-between px-3 py-2 text-sm text-white hover:bg-white/10 hover:text-white",
            salesActive && "bg-white/15 text-white font-medium",
          )}
        >
          <span className="flex items-center gap-3">
            <Receipt className="h-4 w-4" />
            Sales
          </span>
          <ChevronDown className={cn("h-4 w-4 transition", salesOpen && "rotate-180")} />
        </Button>
        {salesOpen && (
          <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
            {salesNavItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                    active ? "bg-white/15 text-white font-medium shadow-xs" : "text-slate-300 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {mainNavItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
              active ? "bg-white/15 text-white font-medium shadow-xs" : "text-slate-300 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  function handleSignOut() {
    clearAuth();
    router.replace("/login");
  }
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(
    pathname.startsWith("/proposals") || pathname.startsWith("/invoices"),
  );

  const salesActive = salesNavItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileNavOpen(false);
  }

  return (
    <div className="mesh-page flex min-h-screen" suppressHydrationWarning>
      <aside className="glass-sidebar no-print hidden w-64 shrink-0 flex-col lg:flex">
        <SidebarBrand />
        <SidebarNav
          pathname={pathname}
          salesOpen={salesOpen}
          setSalesOpen={setSalesOpen}
          salesActive={salesActive}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-header no-print flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1" suppressHydrationWarning>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">Signed in as</p>
            <p className="truncate font-medium tracking-tight">{user?.name}</p>
            {user?.role && (
              <p className="truncate text-xs text-muted-foreground">{ROLE_LABELS[user.role] || user.role}</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-white/50 bg-white/40 backdrop-blur-md"
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </header>
        <main className="flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">{children}</main>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          showCloseButton
          className="glass-sidebar !bg-slate-950/95 !text-white w-[min(18rem,88vw)] gap-0 border-r border-white/10 p-0 sm:max-w-xs [&_[data-slot=sheet-close]]:!text-white [&_[data-slot=sheet-close]]:hover:!bg-white/15"
        >
          <SidebarBrand />
          <SidebarNav
            pathname={pathname}
            salesOpen={salesOpen}
            setSalesOpen={setSalesOpen}
            salesActive={salesActive}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
