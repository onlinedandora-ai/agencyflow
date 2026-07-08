"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Briefcase,
  ChevronDown,
  FileText,
  Kanban,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const mainNavItems = [
  { href: "/pipeline", label: "Pipeline", icon: Users },
  { href: "/clients", label: "Clients", icon: Briefcase },
  { href: "/projects", label: "Projects", icon: Kanban },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Reports", icon: BarChart3, disabled: true },
  { href: "/settings", label: "Settings", icon: Settings, disabled: true },
];

const salesNavItems = [
  { href: "/proposals", label: "Proposals", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const [salesOpen, setSalesOpen] = useState(
    pathname.startsWith("/proposals") || pathname.startsWith("/invoices"),
  );

  const salesActive = salesNavItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <div className="flex min-h-screen">
      <aside className="no-print flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-ink)] text-white">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="text-lg font-semibold tracking-tight">AgencyFlow</div>
          <p className="mt-1 text-xs text-white/60">by SreeDrisya Media</p>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <div>
            <button
              type="button"
              onClick={() => setSalesOpen((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition",
                salesActive ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10",
              )}
            >
              <span className="flex items-center gap-3">
                <Receipt className="h-4 w-4" />
                Sales
              </span>
              <ChevronDown className={cn("h-4 w-4 transition", salesOpen && "rotate-180")} />
            </button>
            {salesOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
                {salesNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                        active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10",
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
                href={item.disabled ? "#" : item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                  active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10",
                  item.disabled && "cursor-not-allowed opacity-40",
                )}
                onClick={(e) => item.disabled && e.preventDefault()}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-shell-header no-print flex items-center justify-between border-b border-[var(--color-border)] bg-white px-6 py-4">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Signed in as</p>
            <p className="font-medium">{user?.name}</p>
          </div>
          <button
            onClick={clearAuth}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
