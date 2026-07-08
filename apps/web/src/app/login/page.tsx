"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("admin@agencyflow.com");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await api.login(email, password);
      setAuth(result.accessToken, result.user);
      router.push("/pipeline");
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-[var(--color-primary)] p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <h1 className="text-4xl font-semibold">AgencyFlow</h1>
        <p className="mt-4 max-w-md text-lg text-white/85">
          Encode your agency SOP as software — from lead capture to delivery, invoicing, and vendor management.
        </p>
        <ul className="mt-8 space-y-2 text-sm text-white/80">
          <li>30-minute lead response SLA tracking</li>
          <li>Advance-payment gates before work starts</li>
          <li>Revision-round enforcement and billing</li>
        </ul>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Access your AgencyFlow workspace</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 outline-none focus:border-[var(--color-primary)]"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 outline-none focus:border-[var(--color-primary)]"
                required
              />
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
            Demo: admin@agencyflow.com / demo123
          </p>
        </form>
      </div>
    </div>
  );
}
