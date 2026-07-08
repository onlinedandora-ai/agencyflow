"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Demo: admin@agencyflow.com / demo123
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
