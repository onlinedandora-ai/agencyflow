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
import {
  isFirebaseConfigured,
  loginWithGoogle,
  loginWithEmailFirebase,
  registerWithEmailFirebase,
  resetPasswordFirebase,
  getFirebaseErrorMessage,
} from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("admin@agencyflow.com");
  const [password, setPassword] = useState("demo123");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
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
    setInfo("");
    setGoogleLoading(true);

    try {
      if (!isFirebaseConfigured) {
        throw new Error(
          "Firebase is not yet configured. Please ensure NEXT_PUBLIC_FIREBASE_* variables are set in .env.local."
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
      setError(getFirebaseErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!hasHydrated) return;
    setLoading(true);
    setError("");
    setInfo("");

    try {
      // First attempt Firebase Email & Password if configured
      if (isFirebaseConfigured) {
        try {
          const { idToken, user } = await loginWithEmailFirebase(email, password);
          const result = await api.firebaseLogin({
            idToken,
            email: user.email || undefined,
            name: user.displayName || undefined,
          });
          setAuth(result.accessToken, result.user);
          setRedirecting(true);
          router.replace("/pipeline");
          return;
        } catch (firebaseErr: unknown) {
          const fbCode = (firebaseErr as { code?: string })?.code;
          // If user exists in local database (e.g. demo accounts), fallback gracefully to local login
          if (
            fbCode === "auth/user-not-found" ||
            fbCode === "auth/invalid-credential" ||
            fbCode === "auth/operation-not-allowed"
          ) {
            // Fallback to database login below
          } else {
            throw firebaseErr;
          }
        }
      }

      // Local / Database authentication (supports demo seed users)
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
        setError(getFirebaseErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!hasHydrated) return;
    setError("");
    setInfo("");

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      if (!isFirebaseConfigured) {
        throw new Error("Firebase is not yet configured. Please set your Firebase variables in .env.local.");
      }
      const { idToken, user } = await registerWithEmailFirebase(email, password, fullName);
      const result = await api.firebaseLogin({
        idToken,
        email: user.email || undefined,
        name: fullName || user.displayName || undefined,
      });
      setAuth(result.accessToken, result.user);
      setRedirecting(true);
      router.replace("/pipeline");
    } catch (err) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address to reset your password.");
      return;
    }
    setLoading(true);
    setError("");
    setInfo("");

    try {
      await resetPasswordFirebase(email);
      setInfo(`Password reset link sent to ${email}. Please check your inbox.`);
      setMode("signin");
    } catch (err) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function setDemoAccount(accountEmail: string) {
    setEmail(accountEmail);
    setPassword("demo123");
    setMode("signin");
    setError("");
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
          <li>✓ 30-minute lead response SLA tracking</li>
          <li>✓ Advance-payment gates before work starts</li>
          <li>✓ Revision-round enforcement and billing</li>
          <li>✓ Native Google Cloud &amp; Firebase Ecosystem</li>
        </ul>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="glass-panel-strong w-full max-w-md border-white/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl tracking-tight">
                  {mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                    ? "Create account"
                    : "Reset password"}
                </CardTitle>
                <CardDescription>
                  {mode === "signin"
                    ? "Access your AgencyFlow workspace"
                    : mode === "signup"
                    ? "Join AgencyFlow with Google or Email"
                    : "We'll send a password recovery email"}
                </CardDescription>
              </div>

              {/* Mode switch pills */}
              <div className="flex gap-1 rounded-lg bg-white/10 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError("");
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    mode === "signin"
                      ? "bg-white/20 text-white shadow"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    mode === "signup"
                      ? "bg-white/20 text-white shadow"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Register
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {info && (
              <Alert className="border-emerald-500/50 bg-emerald-500/10 text-emerald-300">
                <AlertDescription>{info}</AlertDescription>
              </Alert>
            )}

            {/* Google Sign In Button (Available in Sign In and Sign Up) */}
            {mode !== "reset" && (
              <>
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
                  <span>
                    {googleLoading
                      ? "Connecting to Google…"
                      : mode === "signup"
                      ? "Sign up with Google"
                      : "Sign in with Google"}
                  </span>
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
              </>
            )}

            {/* SIGN IN FORM */}
            {mode === "signin" && (
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@agency.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("reset");
                        setError("");
                      }}
                      className="text-xs text-white/60 hover:text-white transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
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

                {/* 1-Click Demo Accounts */}
                <div className="pt-2 border-t border-white/10 text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    1-Click Demo Accounts (Password: demo123):
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDemoAccount("admin@agencyflow.com")}
                      className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setDemoAccount("manager@agencyflow.com")}
                      className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
                    >
                      Manager
                    </button>
                    <button
                      type="button"
                      onClick={() => setDemoAccount("exec@agencyflow.com")}
                      className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
                    >
                      Delivery Exec
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* SIGN UP FORM */}
            {mode === "signup" && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@agency.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password (min 6 chars)</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={loading || googleLoading || warming || !hasHydrated}
                >
                  {loading ? "Creating Account…" : "Create Account & Sign In"}
                </Button>
              </form>
            )}

            {/* PASSWORD RESET FORM */}
            {mode === "reset" && (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Your Account Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@agency.com"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={loading || googleLoading || !hasHydrated}
                >
                  {loading ? "Sending link…" : "Send Reset Email"}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setError("");
                    }}
                    className="text-xs text-white/60 hover:text-white transition-colors"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
