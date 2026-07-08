"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { isAdmin, ROLE_LABELS } from "@/lib/task-utils";
import { Button } from "@/components/ui/button";

const CREATABLE_ROLES = ["ADMIN", "CLIENT_MANAGER", "DELIVERY_EXEC"] as const;

export default function TeamSettingsPage() {
  const token = useAuthStore((s) => s.token)!;
  const user = useAuthStore((s) => s.user);
  const admin = isAdmin(user?.role);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "CLIENT_MANAGER" as (typeof CREATABLE_ROLES)[number],
  });
  const [error, setError] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.getUsers(token),
    enabled: admin,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createUser(token, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["assignable-team"] });
      setForm({ name: "", email: "", password: "", role: "CLIENT_MANAGER" });
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!admin) {
    return (
      <div className="glass-panel p-6">
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="mt-2 text-sm text-muted-foreground">Only admins can manage team members.</p>
        <Link href="/settings" className="mt-4 inline-block text-sm text-primary">
          ← Back to settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Settings
        </Link>
        <h1 className="page-title mt-2">Team</h1>
        <p className="text-sm text-muted-foreground">Create accounts and manage internal team members</p>
      </div>

      <div className="glass-panel p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <UserPlus className="h-5 w-5" />
          Add team member
        </h2>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            createMutation.mutate();
          }}
        >
          <label className="block text-sm">
            <span className="text-muted-foreground">Name</span>
            <input
              className="mt-1 w-full rounded-lg border bg-white/50 px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Email</span>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border bg-white/50 px-3 py-2"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Password</span>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border bg-white/50 px-3 py-2"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              minLength={6}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Role</span>
            <select
              className="mt-1 w-full rounded-lg border bg-white/50 px-3 py-2"
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({ ...f, role: e.target.value as (typeof CREATABLE_ROLES)[number] }))
              }
            >
              {CREATABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role] || role}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
          <div className="md:col-span-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </div>

      <div className="glass-panel p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Users className="h-5 w-5" />
          Team members
        </h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : members.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No team members yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-white/20 last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{member.name}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{member.email}</td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded-full bg-white/40 px-2 py-0.5 text-xs">
                        {ROLE_LABELS[member.role] || member.role}
                      </span>
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
