"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoginRedirectSkeleton } from "@/components/loading-skeletons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { warmupApi } from "@/lib/api-warmup";
import { useAuthStore } from "@/lib/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [email, setEmail] = useState("admin@agencyflow.com");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [warming, setWarming] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    warmupApi().finally(() => setWarming(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasHydrated) return;
    setLoading(true);
    setError("");

    try {
      await warmupApi();
      const result = await api.login(email, password);
      setAuth(result.accessToken, result.user);
      setRedirecting(true);
      router.replace("/pipeline");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      if (message === "Failed to fetch" || message.includes("NetworkError")) {
        setError("Cannot reach the server. Check your connection and try again.");
      } else if (message.toLowerCase().includes("invalid credentials")) {
        setError("Invalid email or password");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  if (redirecting) {
    return <LoginRedirectSkeleton />;
  }

  return (
    <div className="mesh-page flex min-h-screen">
      <div className="glass-sidebar hidden w-1/2 p-12 lg:flex lg:flex-col lg:justify-center">
        <h1 className="text-4xl font-semibold tracking-tight">AgencyFlow</h1>
        <p className="mt-2 text-sm text-white/60">A product of SreeDrisya Media</p>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-white/85">
          Encode your agency SOP as software — from lead capture to delivery, invoicing, and vendor management.
        </p>
        <ul className="mt-8 space-y-2 text-sm text-white/75">
          <li>30-minute lead response SLA tracking</li>
          <li>Advance-payment gates before work starts</li>
          <li>Revision-round enforcement and billing</li>
        </ul>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="glass-panel-strong w-full max-w-md border-white/60">
          <CardHeader>
            <CardTitle className="text-2xl tracking-tight">Sign in</CardTitle>
            <CardDescription>Access your AgencyFlow workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading || warming || !hasHydrated}
              >
                {warming
                  ? "Connecting…"
                  : loading
                    ? "Signing in…"
                    : hasHydrated
                      ? "Sign in"
                      : "Loading…"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Demo accounts (password: demo123): admin@, manager@, exec@agencyflow.com
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
