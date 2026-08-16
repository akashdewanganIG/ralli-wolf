"use client";

import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { SegmentedControl } from "@repo/ui/components/ui/segmented-control";
import { cn } from "@repo/ui/lib/utils";
import ralliWolfLogo from "../app/assets/images/logos/ralli-wolf-logo.png";
import { useAuth } from "../contexts/AuthContext";
import { validateEmailBasic } from "../lib/validation";
import { toast } from "@/lib/toast";
import BrandPanel from "./BrandPanel";

type LoginMethod = "password" | "otp";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [method, setMethod] = useState<LoginMethod>("password");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const {
    login,
    requestLoginOtp,
    loginWithOtp,
    error,
    clearError,
    user,
    isAuthenticated,
    isLoading,
  } = useAuth();
  const router = useRouter();

  const emailError = useMemo(() => {
    if (!email) return undefined;
    const validation = validateEmailBasic(email);
    return validation.isValid ? undefined : validation.error;
  }, [email]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    router.replace(user.role?.toUpperCase() === "SALES" ? "/sales-user" : "/");
  }, [isAuthenticated, user, isLoading, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(
      () => setResendIn(seconds => Math.max(0, seconds - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    if (otpSent) otpInputRef.current?.focus();
  }, [otpSent]);

  const redirectAfterLogin = (role?: string) => {
    router.replace(role?.toUpperCase() === "SALES" ? "/sales-user" : "/");
  };

  const requestOtp = async () => {
    if (!email || emailError) return;
    setIsSubmitting(true);
    clearError();
    try {
      await requestLoginOtp(email.trim().toLowerCase());
      setOtpEmail(email.trim().toLowerCase());
      setOtp("");
      setOtpSent(true);
      setResendIn(30);
      toast.info("Sign-in code sent", {
        description: `Check ${email.trim().toLowerCase()} for your six-digit code.`,
      });
    } catch {
      // The shared authentication context exposes a safe message below.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || emailError) return;

    if (method === "otp" && !otpSent) {
      await requestOtp();
      return;
    }

    setIsSubmitting(true);
    clearError();
    try {
      const loggedInUser =
        method === "password"
          ? await login(
              { email: email.trim().toLowerCase(), password },
              rememberMe
            )
          : await loginWithOtp({ email: otpEmail, otp }, rememberMe);
      toast.success("Welcome back", {
        description: "You are signed in to Ralli Wolf.",
      });
      redirectAfterLogin(loggedInUser.role);
    } catch {
      // The shared authentication context exposes a safe message below.
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMethod = (nextMethod: LoginMethod) => {
    setMethod(nextMethod);
    setOtpSent(false);
    setOtp("");
    setResendIn(0);
    clearError();
  };

  if (isLoading && !isSubmitting) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-white">
        <Loader2
          className="size-7 animate-spin text-primary"
          aria-label="Loading session"
        />
      </div>
    );
  }

  const submitDisabled =
    isSubmitting ||
    !!emailError ||
    !email ||
    (method === "password" ? !password : otpSent ? otp.length !== 6 : false);

  return (
    <div
      className={cn(
        "grid min-h-svh w-full gap-4 bg-white p-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(28rem,0.7fr)] lg:gap-6 lg:p-3 lg:pr-6",
        className
      )}
      {...props}
    >
      <BrandPanel />

      <main className="flex min-h-[calc(100svh-1rem)] items-center justify-center px-4 py-8 sm:px-8 lg:min-h-[calc(100svh-1.5rem)] lg:px-12 xl:px-20">
        <div className="w-full max-w-[24rem]">
          <Image
            src={ralliWolfLogo}
            alt="Ralli Wolf"
            width={200}
            height={38}
            priority
            className="h-8 w-auto object-contain"
          />

          <div className="mt-12">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Sign in to your account to continue.
            </p>
          </div>

          <SegmentedControl
            value={method}
            onValueChange={switchMethod}
            label="Sign-in method"
            className="mt-8 w-full grid-cols-2"
            items={[
              { value: "password", label: "Password", icon: LockKeyhole },
              { value: "otp", label: "Email code", icon: KeyRound },
            ]}
          />

          <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-lg border border-error/20 bg-error-surface px-4 py-3 text-sm text-error-foreground"
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground"
                >
                  Work email
                </label>
                {method === "otp" && otpSent ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp("");
                      setResendIn(0);
                      clearError();
                    }}
                    className="rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/30 whitespace-nowrap"
                  >
                    Change email
                  </button>
                ) : null}
              </div>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  disabled={method === "otp" && otpSent}
                  required
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "email-error" : undefined}
                  className="pl-10"
                />
              </div>
              {emailError && (
                <p id="email-error" className="text-xs text-destructive">
                  {emailError}
                </p>
              )}
            </div>

            {method === "password" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-foreground"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/30 whitespace-nowrap"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    required
                    className="pl-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(visible => !visible)}
                    className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            ) : otpSent ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-success/20 bg-success-surface px-4 py-3.5 text-success-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <p className="text-xs leading-5">
                    A 6-digit code was sent if this email belongs to an active
                    account. It expires in 10 minutes.
                  </p>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="login-otp"
                    className="text-sm font-medium text-foreground"
                  >
                    Verification code
                  </label>
                  <Input
                    ref={otpInputRef}
                    id="login-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={event =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="text-center font-mono text-lg tracking-[0.28em]"
                    aria-describedby="otp-help"
                    required
                  />
                  <div
                    id="otp-help"
                    className="flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground"
                  >
                    <span>Single-use code</span>
                    <button
                      type="button"
                      disabled={resendIn > 0 || isSubmitting}
                      onClick={requestOtp}
                      className="rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/30 disabled:text-zinc-400 disabled:no-underline whitespace-nowrap"
                    >
                      {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-info/20 bg-info-surface px-4 py-3.5 text-sm leading-5 text-info-foreground">
                We’ll email a single-use code to the address above. No password
                is required.
              </p>
            )}

            <label className="flex w-fit cursor-pointer items-center gap-2.5 px-1 text-sm text-zinc-600">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={checked => setRememberMe(checked === true)}
              />
              Keep me signed in for 7 days
            </label>

            <Button
              type="submit"
              size="lg"
              disabled={submitDisabled}
              className="h-11 w-full rounded-xl text-base shadow-sm"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {isSubmitting
                ? method === "otp" && !otpSent
                  ? "Sending code…"
                  : "Signing in…"
                : method === "password"
                  ? "Sign in"
                  : otpSent
                    ? "Verify and sign in"
                    : "Send sign-in code"}
              {!isSubmitting ? <ArrowRight className="ml-1 size-4" /> : null}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Ralli Wolf. Authorized access only.
          </p>
        </div>
      </main>
    </div>
  );
}
