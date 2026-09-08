"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Loader2,
  ShieldCheck,
  MailCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { api, ApiError } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type LoginFormValues = z.infer<typeof loginSchema>;

interface DemoAccount {
  role: string;
  email: string;
  password: string;
  icon: LucideIcon;
}

/**
 * Demo credentials are a local-development convenience only. The ternary is
 * evaluated at build time, so in a production bundle this collapses to `[]`
 * and the passwords are never shipped to the browser at all.
 */
const SHOW_DEMO_ACCOUNTS = process.env.NODE_ENV !== "production";

const DEMO_ACCOUNTS: readonly DemoAccount[] = SHOW_DEMO_ACCOUNTS
  ? [
      { role: "Admin", email: "admin@edusphere.test", password: "Admin@123", icon: ShieldCheck },
      { role: "Teacher", email: "teacher@edusphere.test", password: "Teacher@123", icon: BookOpen },
      { role: "Student", email: "student@edusphere.test", password: "Student@123", icon: GraduationCap },
      { role: "Parent", email: "parent@edusphere.test", password: "Parent@123", icon: UsersRound },
    ]
  : [];

const FEATURES = [
  { icon: ShieldCheck, title: "Admin control", text: "Students, staff, classes & finances" },
  { icon: BookOpen, title: "Teacher tools", text: "Attendance & marks in a couple of clicks" },
  { icon: GraduationCap, title: "Student portal", text: "Results, timetable & fee status" },
  { icon: UsersRound, title: "Parent visibility", text: "Follow your child's progress" },
] as const;

type Mode = "login" | "forgot" | "requested" | "reset" | "done";

function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={
          "flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md " +
          (size === "lg" ? "size-11" : "size-9")
        }
      >
        <GraduationCap className={size === "lg" ? "size-6" : "size-5"} aria-hidden />
      </div>
      <div className="leading-tight">
        <p className="text-base font-bold tracking-tight">EduSphere</p>
        <p className="text-[11px] text-muted-foreground">School Management System</p>
      </div>
    </div>
  );
}

export function LoginScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot / reset flow state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotResult, setForgotResult] = useState<{ token: string; name: string } | null>(null);
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onLogin(values: LoginFormValues) {
    setError(null);
    try {
      await login(values.email, values.password);
      toast.success("Welcome back!");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Login failed. Please try again.";
      setError(message);
      toast.error(message);
    }
  }

  function fillDemo(account: DemoAccount) {
    setMode("login");
    setError(null);
    form.reset({ email: account.email, password: account.password });
  }

  async function sendForgot() {
    const parsed = z.email().safeParse(forgotEmail);
    if (!parsed.success) {
      toast.error("Enter a valid email address");
      return;
    }
    setForgotBusy(true);
    try {
      const data = await api.post<{
        success: boolean;
        delivered: boolean;
        token?: string;
        name?: string;
      }>("/api/auth/forgot-password", { email: forgotEmail });

      // In production the server never returns a token, and answers the same
      // way for unknown addresses — so show a neutral confirmation instead.
      if (!data.delivered || !data.token) {
        setMode("requested");
        return;
      }

      setForgotResult({ token: data.token, name: data.name ?? "" });
      setResetToken(data.token);
      setResetPassword("");
      setMode("reset");
      toast.success("Reset token generated");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not generate a reset token.";
      toast.error(message);
    } finally {
      setForgotBusy(false);
    }
  }

  async function submitReset() {
    if (resetToken.trim().length < 6) {
      toast.error("Enter the reset token");
      return;
    }
    if (resetPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    setResetBusy(true);
    try {
      await api.post("/api/auth/reset-password", { token: resetToken.trim(), password: resetPassword });
      setMode("done");
      toast.success("Password updated — you can sign in now");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not reset the password.";
      toast.error(message);
    } finally {
      setResetBusy(false);
    }
  }

  function backToLogin() {
    setMode("login");
    setError(null);
    setForgotResult(null);
    setForgotEmail("");
    setResetToken("");
    setResetPassword("");
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left branded panel ─────────────────────────────── */}
      <aside className="relative hidden w-[46%] max-w-2xl flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 p-10 text-white lg:flex xl:p-14">
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-teal-400/10 blur-2xl" aria-hidden />

        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <GraduationCap className="size-6" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">EduSphere</p>
            <p className="text-xs text-emerald-100/80">School Management System</p>
          </div>
        </div>

        <div className="relative">
          <h1 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            One campus.
            <br />
            One platform.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-emerald-50/85">
            Attendance, exams, fees, timetables and announcements — everything your school
            runs on, together in one place.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/12">
                  <f.icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{f.title}</span>
                  <span className="block text-xs text-emerald-50/75">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-emerald-100/60">© 2025 EduSphere · Built with Next.js</p>
      </aside>

      {/* ── Right auth card ────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <BrandMark />
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            {mode === "login" ? (
              <>
                <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
                <p className="mt-1 text-sm text-muted-foreground">Sign in to your EduSphere account.</p>

                {DEMO_ACCOUNTS.length > 0 ? (
                  <div className="mt-5 rounded-xl border bg-muted/40 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Demo accounts — one click to fill (development only)
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {DEMO_ACCOUNTS.map((acc) => (
                        <Button
                          key={acc.role}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-start gap-2"
                          onClick={() => fillDemo(acc)}
                        >
                          <acc.icon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                          {acc.role}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <form onSubmit={form.handleSubmit(onLogin)} className="mt-5 grid gap-4" noValidate>
                  {error ? (
                    <Alert variant="destructive" role="alert">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="grid gap-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@edusphere.test"
                      aria-invalid={Boolean(form.formState.errors.email)}
                      {...form.register("email")}
                    />
                    {form.formState.errors.email ? (
                      <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="pr-10"
                        aria-invalid={Boolean(form.formState.errors.password)}
                        {...form.register("password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                      </button>
                    </div>
                    {form.formState.errors.password ? (
                      <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                    ) : null}
                  </div>

                  <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : null}
                    {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
                  </Button>
                </form>

                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="mx-auto mt-4 block text-sm font-medium text-emerald-700 underline-offset-4 transition-colors hover:underline dark:text-emerald-400"
                >
                  Forgot password?
                </button>
              </>
            ) : mode === "forgot" ? (
              <>
                <button
                  type="button"
                  onClick={backToLogin}
                  className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  Back to sign in
                </button>
                <h2 className="text-xl font-semibold tracking-tight">Reset your password</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {SHOW_DEMO_ACCOUNTS
                    ? "Enter your account email. In this dev environment the reset token is shown right here."
                    : "Enter your account email and we'll send you a link to choose a new password."}
                </p>
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="forgot-email">Account email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@edusphere.test"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                    />
                  </div>
                  <Button onClick={() => void sendForgot()} disabled={forgotBusy}>
                    {forgotBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
                    {forgotBusy
                      ? "Sending…"
                      : SHOW_DEMO_ACCOUNTS
                        ? "Generate reset token"
                        : "Send reset link"}
                  </Button>
                </div>
              </>
            ) : mode === "requested" ? (
              /* Neutral confirmation — says nothing about whether the address exists. */
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <MailCheck className="size-12 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <h2 className="text-xl font-semibold tracking-tight">Check your inbox</h2>
                <p className="text-sm text-muted-foreground">
                  If an account exists for <span className="font-medium">{forgotEmail}</span>, a password
                  reset link is on its way. If it doesn&apos;t arrive, please contact the school office.
                </p>
                <Button onClick={backToLogin} className="mt-2">
                  <ArrowLeft className="size-4" aria-hidden />
                  Back to sign in
                </Button>
              </div>
            ) : mode === "reset" ? (
              <>
                <button
                  type="button"
                  onClick={backToLogin}
                  className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  Back to sign in
                </button>
                <h2 className="text-xl font-semibold tracking-tight">
                  Reset password{forgotResult ? ` for ${forgotResult.name}` : ""}
                </h2>
                {forgotResult ? (
                  <Alert className="mt-3 border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <AlertDescription className="break-all">
                      <span className="font-semibold">Dev token:</span> {forgotResult.token}
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="mt-4 grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="reset-token">Reset token</Label>
                    <Input
                      id="reset-token"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste the token"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="reset-password">New password</Label>
                    <Input
                      id="reset-password"
                      type="password"
                      autoComplete="new-password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <Button onClick={() => void submitReset()} disabled={resetBusy}>
                    {resetBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
                    {resetBusy ? "Updating…" : "Set new password"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="size-12 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <h2 className="text-xl font-semibold tracking-tight">Password updated</h2>
                <p className="text-sm text-muted-foreground">
                  Your password has been changed. Sign in with your new password.
                </p>
                <Button onClick={backToLogin} className="mt-2">
                  <UserRound className="size-4" aria-hidden />
                  Back to sign in
                </Button>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
            © 2025 EduSphere · Built with Next.js
          </p>
        </div>
      </main>
    </div>
  );
}
