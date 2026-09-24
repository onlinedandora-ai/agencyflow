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
  loginWithGoogleRedirect,
  checkGoogleRedirectResult,
  loginWithEmailFirebase,
  registerWithEmailFirebase,
  resetPasswordFirebase,
  getFirebaseErrorMessage,
} from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isHydrated = mounted && hasHydrated;

  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [warming, setWarming] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    warmupApi();
    router.prefetch("/pipeline");
    if (token) {
      router.replace("/pipeline");
      return;
    }

    // Check for Google redirect result (if popup was blocked and redirect was used)
    checkGoogleRedirectResult()
      .then(async (res) => {
        if (res) {
          setGoogleLoading(true);
          const result = await api.firebaseLogin({
            idToken: res.idToken,
            email: res.user.email || undefined,
            name: res.user.displayName || undefined,
          });
          setAuth(result.accessToken, result.user);
          setRedirecting(true);
          router.replace("/pipeline");
        }
      })
      .catch((err) => {
        setError(getFirebaseErrorMessage(err));
      })
      .finally(() => {
        setGoogleLoading(false);
      });
  }, [token, router, setAuth]);

  async function handleGoogleSignIn() {
    if (!isHydrated) return;
    setError("");
    setInfo("");
    setGoogleLoading(true);

    try {
      if (!isFirebaseConfigured) {
        throw new Error(
          "Firebase authentication is not configured. Please check your environment variables."
        );
      }
      const googleRes = await loginWithGoogle();
      if (!googleRes) {
        // Redirect flow initiated
        return;
      }
      const { idToken, user } = googleRes;
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

  async function handleGoogleRedirectSignIn() {
    if (!isHydrated) return;
    setError("");
    setInfo("");
    setGoogleLoading(true);

    try {
      if (!isFirebaseConfigured) {
        throw new Error(
          "Firebase authentication is not configured. Please check your environment variables."
        );
      }
      await loginWithGoogleRedirect();
    } catch (err) {
      setError(getFirebaseErrorMessage(err));
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
          if (
            fbCode === "auth/user-not-found" ||
            fbCode === "auth/invalid-credential" ||
            fbCode === "auth/operation-not-allowed" ||
            fbCode === "auth/configuration-not-found"
          ) {
            // Fallback to database login below
          } else {
            throw firebaseErr;
          }
        }
      }

      // Local / Database authentication fallback
      await warmupApi();
      const result = await api.login(email, password);
      setAuth(result.accessToken, result.user);
      setRedirecting(true);
      router.replace("/pipeline");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      if (message === "Failed to fetch" || message.includes("NetworkError")) {
        setError("Cannot reach the server. Please check your internet connection.");
      } else if (message.toLowerCase().includes("invalid credentials")) {
        setError("Invalid email or password. Please try again.");
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
        throw new Error("Firebase authentication is not configured. Please check your settings.");
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

  if (redirecting) {
    return <LoginRedirectSkeleton />;
  }

  return (
    <div className="mesh-page flex min-h-screen flex-col lg:flex-row">
      {/* Left Brand Panel (Desktop) */}
      <div className="glass-sidebar hidden w-full lg:w-1/2 p-8 lg:p-16 lg:flex lg:flex-col lg:justify-between relative overflow-hidden bg-slate-950/85">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold text-xl">
            D
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight text-white">Dandora.online</span>
            <span className="block text-xs text-slate-400">by SreeDrisya Media</span>
          </div>
        </div>

        <div className="my-auto max-w-lg py-12">
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Encode your agency SOP as software.
          </h1>
          <p className="mt-4 text-base lg:text-lg leading-relaxed text-slate-300">
            From initial lead capture to client approval, milestone invoicing, and delivery tracking — everything in one seamless flow.
          </p>

          <div className="mt-10 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs mt-0.5">
                ✓
              </div>
              <div>
                <p className="text-sm font-semibold text-white">30-minute lead response SLA tracking</p>
                <p className="text-xs text-slate-400">Never let a high-intent inquiry go cold with automatic alerts.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs mt-0.5">
                ✓
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Advance-payment gates before execution</p>
                <p className="text-xs text-slate-400">Lock work stages until milestone payments and agreements clear.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs mt-0.5">
                ✓
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Strict revision round enforcement &amp; billing</p>
                <p className="text-xs text-slate-400">Eliminate scope creep with tracked deliverable revisions.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 border-t border-white/10 pt-4">
          <span>© {new Date().getFullYear()} SreeDrisya Media. All rights reserved.</span>
          <span>Enterprise Ready</span>
        </div>
      </div>

      {/* Right Auth Form Section */}
      <div className="flex flex-1 flex-col items-center justify-center p-4 sm:p-8 lg:p-12">
        {/* Mobile Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold text-2xl mb-2">
            D
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Dandora.online</h2>
          <p className="text-xs text-slate-500">by SreeDrisya Media</p>
        </div>

        <Card className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/90 shadow-2xl backdrop-blur-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
                  {mode === "signin"
                    ? "Sign In"
                    : mode === "signup"
                    ? "Create Account"
                    : "Reset Password"}
                </CardTitle>
                <CardDescription className="text-slate-600 text-xs sm:text-sm mt-0.5">
                  {mode === "signin"
                    ? "Access your Dandora.online workspace"
                    : mode === "signup"
                    ? "Join Dandora.online with Google or Email"
                    : "Enter your email to receive recovery instructions"}
                </CardDescription>
              </div>

              {/* Mode switch pills */}
              <div className="flex shrink-0 items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError("");
                    setInfo("");
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    mode === "signin"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    setInfo("");
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    mode === "signup"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Register
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-700">
                <AlertDescription className="text-xs sm:text-sm leading-relaxed break-words">
                  {error.split(/(https?:\/\/[^\s)]+)/g).map((part, i) =>
                    part.startsWith("http") ? (
                      <a
                        key={i}
                        href={part}
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-bold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 mx-1"
                      >
                        Open Firebase Console ↗
                      </a>
                    ) : (
                      part
                    )
                  )}
                </AlertDescription>
              </Alert>
            )}

            {info && (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                <AlertDescription className="text-xs sm:text-sm">{info}</AlertDescription>
              </Alert>
            )}

            {/* High-Contrast Google Sign In Button */}
            {mode !== "reset" && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || loading || !isHydrated}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
                >
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
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
                  <span className="text-slate-800 font-semibold">
                    {googleLoading
                      ? "Connecting to Google…"
                      : mode === "signup"
                      ? "Sign up with Google"
                      : "Sign in with Google"}
                  </span>
                </button>

                <div className="flex items-center justify-center gap-1 text-center -mt-2">
                  <button
                    type="button"
                    onClick={handleGoogleRedirectSignIn}
                    disabled={googleLoading || loading || !isHydrated}
                    className="text-[11px] text-slate-500 hover:text-indigo-600 underline font-medium transition-colors cursor-pointer"
                  >
                    Popup blocked? Sign in with Google (Redirect) →
                  </button>
                </div>

                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200" />
                  </div>
                  <span className="relative bg-white px-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                    Or continue with email
                  </span>
                </div>
              </div>
            )}

            {/* SIGN IN FORM */}
            {mode === "signin" && (
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@agency.com"
                    required
                    className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-600 focus-visible:ring-indigo-600/20 shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("reset");
                        setError("");
                        setInfo("");
                      }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-600 focus-visible:ring-indigo-600/20 shadow-xs"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/25 transition-all active:scale-[0.99]"
                  disabled={loading || googleLoading || warming || !isHydrated}
                >
                  {warming
                    ? "Connecting…"
                    : loading
                    ? "Signing in…"
                    : isHydrated
                    ? "Sign In"
                    : "Loading…"}
                </Button>
              </form>
            )}

            {/* SIGN UP FORM */}
            {mode === "signup" && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                    className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-600 focus-visible:ring-indigo-600/20 shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-email" className="text-xs font-semibold text-slate-700">
                    Email
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@agency.com"
                    required
                    className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-600 focus-visible:ring-indigo-600/20 shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-password" className="text-xs font-semibold text-slate-700">
                    Password (min 6 characters)
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    required
                    className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-600 focus-visible:ring-indigo-600/20 shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs font-semibold text-slate-700">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                    className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-600 focus-visible:ring-indigo-600/20 shadow-xs"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/25 transition-all active:scale-[0.99]"
                  disabled={loading || googleLoading || warming || !isHydrated}
                >
                  {loading ? "Creating Account…" : "Create Account & Sign In"}
                </Button>
              </form>
            )}

            {/* PASSWORD RESET FORM */}
            {mode === "reset" && (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email" className="text-xs font-semibold text-slate-700">
                    Account Email
                  </Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@agency.com"
                    required
                    className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-600 focus-visible:ring-indigo-600/20 shadow-xs"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/25 transition-all active:scale-[0.99]"
                  disabled={loading || googleLoading || !isHydrated}
                >
                  {loading ? "Sending Link…" : "Send Reset Link"}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setError("");
                      setInfo("");
                    }}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
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
