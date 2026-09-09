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
import { isFirebaseConfigured, loginWithGoogle } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [email, setEmail] = useState("admin@agencyflow.com");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [warming, setWarming] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    warmupApi().finally(() => setWarming(false));
  }, []);

  async function handleGoogleSignIn() {
    if (!hasHydrated) return;
    setError("");
    setGoogleLoading(true);

    try {
      if (!isFirebaseConfigured) {
        throw new Error(
          "Firebase is not yet configured. Please add NEXT_PUBLIC_FIREBASE_* environment variables in .env.local to enable Google Login."
        );
      }
      const { idToken, user } = await loginWithGoogle();
      const result = await api.firebaseLogin({
        idToken,
        email: user.email || undefined,
        name: user.displayName || undefined,
      });
      setAuth(result.accessToken, result.user);
      setRedirecting(true);
      router.replace("/pipeline");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
    } finally {
      setGoogleLoading(false);
    }
  }

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
          <li>Integrated with Google Cloud &amp; Firebase</li>
        </ul>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="glass-panel-strong w-full max-w-md border-white/60">
          <CardHeader>
            <CardTitle className="text-2xl tracking-tight">Sign in</CardTitle>
            <CardDescription>Access your AgencyFlow workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Google Sign In Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 py-5 transition-all"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading || !hasHydrated}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{googleLoading ? "Connecting to Google…" : "Sign in with Google"}</span>
            </Button>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/15" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background/80 px-2 text-white/50 backdrop-blur-sm">
                  Or continue with email
                </span>
              </div>
            </div>

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

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading || googleLoading || warming || !hasHydrated}
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
