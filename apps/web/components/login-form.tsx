"use client";

import { ArrowLeft, Eye, EyeOff } from "@repo/ui/icons";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";
import ralliWolfLogo from "../app/assets/images/logos/ralli-wolf-logo.png";
import { useAuth } from "../contexts/auth-context";
import type { ApiError } from "../lib/api/types";
import { healthService } from "../lib/api/services";
import { validateEmailBasic } from "../lib/validation";
import { toast } from "@/lib/toast";
import LoginShowcase from "./login-showcase";
import LoginProviders from "./login-providers";
import LoginFaq from "./login-faq";
import LoginFooter from "./login-footer";

type Step = "credentials" | "code";
type Factor = "totp" | "email";

const RESEND_COOLDOWN_SECONDS = 30;
const SERVICE_WAKE_TIMEOUT_SECONDS = 90;
const SERVICE_HEALTH_POLL_MS = 5_000;
const SERVICE_HEALTH_REQUEST_TIMEOUT_MS = 8_000;

function asApiError(error: unknown): ApiError | null {
  return error && typeof error === "object" && "status" in error
    ? (error as ApiError)
    : null;
}

function describeLoginError(error: unknown): {
  title: string;
  description: string;
} {
  const apiError = asApiError(error);

  if (!apiError) {
    return {
      title: "Could not reach the server",
      description: "Check your connection and try again.",
    };
  }

  switch (apiError.code) {
    case "HOSTING_SERVICE_WAKING":
      return {
        title: "Service is starting",
        description:
          "The hosted API was asleep and is waking up. Please try again in about a minute.",
      };
    case "INVALID_CREDENTIALS":
      return {
        title: "Invalid email or password",
        description:
          "Check both and try again. You can reset a forgotten password from “Forgot password”.",
      };
    case "ACCOUNT_DEACTIVATED":
      return {
        title: "Account deactivated",
        description:
          "This account no longer has access. Contact your administrator to restore it.",
      };
    case "OTP_DELIVERY_FAILED":
      return {
        title: "Could not send your code",
        description:
          "Your password was correct, but the email did not go out. Try again in a moment.",
      };
    default:
      break;
  }

  if (apiError.status === 403) {
    return {
      title: "Sign-in blocked",
      description: apiError.message || "This account cannot sign in here.",
    };
  }
  if (apiError.status === 429) {
    return {
      title: "Too many attempts",
      description:
        "Sign-in requests are temporarily limited for this email and network. Wait a few minutes before trying again.",
    };
  }
  if (apiError.status >= 500) {
    return {
      title: "Something went wrong on our end",
      description: "Please try signing in again shortly.",
    };
  }

  return {
    title: "Could not sign you in",
    description: apiError.message || "Please check your details and try again.",
  };
}

function describeOtpError(error: unknown): {
  title: string;
  description: string;
  sessionExpired: boolean;
} {
  const apiError = asApiError(error);

  if (!apiError) {
    return {
      title: "Could not reach the server",
      description: "Check your connection and try again.",
      sessionExpired: false,
    };
  }

  switch (apiError.code) {
    case "INVALID_OTP": {
      const left = apiError.attemptsRemaining;
      return {
        title: "That code is incorrect",
        description:
          typeof left === "number" && left > 0
            ? `${left} ${left === 1 ? "attempt" : "attempts"} left before you will need a new code.`
            : "Check the six digits and try again.",
        sessionExpired: false,
      };
    }
    case "OTP_EXPIRED":
      return {
        title: "That code has expired",
        description: "Codes last 10 minutes. Send yourself a new one.",
        sessionExpired: false,
      };
    case "OTP_ATTEMPTS_EXCEEDED":
      return {
        title: "Too many incorrect codes",
        description: "Request a new code to continue signing in.",
        sessionExpired: false,
      };
    case "MFA_SESSION_EXPIRED":
      return {
        title: "Your sign-in session expired",
        description: "Enter your password again to start over.",
        sessionExpired: true,
      };
    default:
      break;
  }

  if (apiError.status === 429) {
    return {
      title: "Too many attempts",
      description: "Wait a few minutes before trying this code again.",
      sessionExpired: false,
    };
  }

  return {
    title: "Could not verify that code",
    description: apiError.message || "Please try again.",
    sessionExpired: false,
  };
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [step, setStep] = useState<Step>("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [factor, setFactor] = useState<Factor>("email");
  const [availableFactors, setAvailableFactors] = useState<Factor[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isServiceWaking, setIsServiceWaking] = useState(false);
  const [serviceWakeSeconds, setServiceWakeSeconds] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const serviceWakeSequenceRef = useRef(0);
  const serviceWakeToastRef = useRef<string | number | undefined>(undefined);
  const serviceWakeCountdownRef = useRef<number | undefined>(undefined);
  const serviceWakeAbortRef = useRef<AbortController | null>(null);
  const {
    login,
    resendLoginOtp,
    loginWithOtp,
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
    if (step === "code") otpInputRef.current?.focus();
  }, [step]);

  useEffect(
    () => () => {
      serviceWakeSequenceRef.current += 1;
      if (serviceWakeCountdownRef.current !== undefined) {
        window.clearInterval(serviceWakeCountdownRef.current);
        serviceWakeCountdownRef.current = undefined;
      }
      serviceWakeAbortRef.current?.abort();
      serviceWakeAbortRef.current = null;
      if (serviceWakeToastRef.current !== undefined) {
        toast.dismiss(serviceWakeToastRef.current);
        serviceWakeToastRef.current = undefined;
      }
    },
    []
  );

  const startServiceWakeup = useCallback(() => {
    if (serviceWakeToastRef.current !== undefined) return;

    const sequence = ++serviceWakeSequenceRef.current;
    const startedAt = Date.now();
    setIsServiceWaking(true);
    setServiceWakeSeconds(SERVICE_WAKE_TIMEOUT_SECONDS);

    const toastId = toast.loading("Starting the service", {
      description: `Checking API readiness · up to ${SERVICE_WAKE_TIMEOUT_SECONDS} seconds remaining`,
      duration: Infinity,
    });
    serviceWakeToastRef.current = toastId;

    serviceWakeCountdownRef.current = window.setInterval(() => {
      if (serviceWakeSequenceRef.current !== sequence) return;
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, SERVICE_WAKE_TIMEOUT_SECONDS - elapsed);
      setServiceWakeSeconds(remaining);
      toast.loading("Starting the service", {
        id: toastId,
        description: `Checking API readiness · up to ${remaining} seconds remaining`,
        duration: Infinity,
      });
    }, 1_000);

    const finish = () => {
      if (serviceWakeCountdownRef.current !== undefined) {
        window.clearInterval(serviceWakeCountdownRef.current);
        serviceWakeCountdownRef.current = undefined;
      }
      serviceWakeAbortRef.current?.abort();
      serviceWakeAbortRef.current = null;
      serviceWakeToastRef.current = undefined;
      setIsServiceWaking(false);
      setServiceWakeSeconds(0);
    };

    const checkUntilReady = async () => {
      while (serviceWakeSequenceRef.current === sequence) {
        const remainingBeforeRequest =
          SERVICE_WAKE_TIMEOUT_SECONDS * 1_000 - (Date.now() - startedAt);
        if (remainingBeforeRequest <= 0) {
          finish();
          toast.error("The service is taking longer than expected", {
            id: toastId,
            description: "Please wait another minute, then try signing in.",
            duration: 8_000,
          });
          return;
        }

        const controller = new AbortController();
        serviceWakeAbortRef.current = controller;
        const health = await healthService
          .checkHealth({
            timeoutMs: Math.min(
              SERVICE_HEALTH_REQUEST_TIMEOUT_MS,
              remainingBeforeRequest
            ),
            signal: controller.signal,
          })
          .catch(() => null);
        if (serviceWakeAbortRef.current === controller) {
          serviceWakeAbortRef.current = null;
        }
        if (serviceWakeSequenceRef.current !== sequence) {
          if (serviceWakeCountdownRef.current !== undefined) {
            window.clearInterval(serviceWakeCountdownRef.current);
            serviceWakeCountdownRef.current = undefined;
          }
          return;
        }
        if (health?.status === "ok" && health.database === "connected") {
          finish();
          toast.success("Service is ready", {
            id: toastId,
            description: "You can sign in now.",
            duration: 5_000,
          });
          return;
        }

        const remainingAfterRequest =
          SERVICE_WAKE_TIMEOUT_SECONDS * 1_000 - (Date.now() - startedAt);
        if (remainingAfterRequest <= 0) {
          finish();
          toast.error("The service is taking longer than expected", {
            id: toastId,
            description: "Please wait another minute, then try signing in.",
            duration: 8_000,
          });
          return;
        }

        await new Promise(resolve =>
          window.setTimeout(
            resolve,
            Math.min(SERVICE_HEALTH_POLL_MS, remainingAfterRequest)
          )
        );
      }
      if (serviceWakeCountdownRef.current !== undefined) {
        window.clearInterval(serviceWakeCountdownRef.current);
        serviceWakeCountdownRef.current = undefined;
      }
    };

    void checkUntilReady();
  }, []);

  const returnToCredentials = () => {
    setStep("credentials");
    setOtp("");
    setMfaToken("");
    setMaskedEmail("");
    setResendIn(0);
    clearError();
  };

  const submitCredentials = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setIsSubmitting(true);
    clearError();
    try {
      const challenge = await login({ email: normalizedEmail, password });
      if (!challenge.mfaRequired) {
        toast.success("Welcome back", {
          description: "You are signed in to Ralli Wolf.",
        });
        router.replace(
          challenge.user.role?.toUpperCase() === "SALES" ? "/sales-user" : "/"
        );
        return;
      }
      setMfaToken(challenge.mfaToken);
      setMaskedEmail(challenge.maskedEmail);
      setFactor(challenge.factor);
      setAvailableFactors(challenge.availableFactors ?? []);
      setOtp("");
      setStep("code");

      setResendIn(challenge.factor === "email" ? RESEND_COOLDOWN_SECONDS : 0);
      if (challenge.factor === "email") {
        toast.info("Check your email for a code", {
          description: `We sent a 6-digit code to ${challenge.maskedEmail}. It expires in 10 minutes.`,
        });
      } else {
        toast.info("Enter your authenticator code", {
          description:
            "Open your authenticator app for the current 6-digit code.",
        });
      }
    } catch (error) {
      if (asApiError(error)?.code === "HOSTING_SERVICE_WAKING") {
        startServiceWakeup();
        return;
      }
      const { title, description } = describeLoginError(error);
      toast.error(title, { description });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitOtp = async () => {
    setIsSubmitting(true);
    clearError();
    try {
      const loggedInUser = await loginWithOtp({ mfaToken, otp });
      toast.success("Welcome back", {
        description: "You are signed in to Ralli Wolf.",
      });
      router.replace(
        loggedInUser.role?.toUpperCase() === "SALES" ? "/sales-user" : "/"
      );
    } catch (error) {
      const { title, description, sessionExpired } = describeOtpError(error);
      toast.error(title, { description });
      if (sessionExpired) returnToCredentials();
      else setOtp("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendCode = async () => {
    setIsSubmitting(true);
    clearError();
    try {
      const result = await resendLoginOtp(mfaToken);
      setOtp("");
      setFactor("email");
      setResendIn(RESEND_COOLDOWN_SECONDS);
      toast.info("New code sent", {
        description: `A fresh 6-digit code is on its way to ${result.maskedEmail}.`,
      });
      otpInputRef.current?.focus();
    } catch (error) {
      const { title, description, sessionExpired } = describeOtpError(error);
      toast.error(title, { description });
      if (sessionExpired) returnToCredentials();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step === "credentials") {
      if (!email || emailError) return;
      await submitCredentials();
      return;
    }
    if (otp.length !== 6) return;
    await submitOtp();
  };

  if (isLoading && !isSubmitting) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background"></div>
    );
  }

  const submitDisabled =
    isSubmitting ||
    isServiceWaking ||
    (step === "credentials" ? !!emailError || !email : otp.length !== 6);

  const canFallBackToEmail =
    step === "code" && factor === "totp" && availableFactors.includes("email");

  return (
    <div
      className={cn(
        "login-page flex min-h-svh w-full flex-col bg-[var(--login-bg)]",
        className
      )}
      {...props}
    >
      <div className="mx-auto grid min-h-svh w-full max-w-[100rem] flex-1 items-stretch gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-6 lg:p-6">
        <main className="flex flex-col">
          <Image
            src={ralliWolfLogo}
            alt="Ralli Wolf"
            width={800}
            height={150}
            priority
            className="h-6 w-auto shrink-0 self-start object-contain"
          />

          <div className="my-auto w-full lg:pl-20 xl:pl-28">
            <div className="mx-auto w-full max-w-[22rem] pt-10">
              <div>
                <h1 className="font-brand text-xl tracking-tight text-foreground">
                  {step === "credentials"
                    ? "Partner portal"
                    : "Confirm it is you"}
                </h1>

                {step === "credentials" ? null : (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {factor === "totp" ? (
                      "Enter the current 6-digit code from your authenticator app."
                    ) : (
                      <>
                        Enter the 6-digit code sent to{" "}
                        <span className="font-medium text-foreground">
                          {maskedEmail}
                        </span>
                        .
                      </>
                    )}
                  </p>
                )}
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-5 space-y-3"
                noValidate
              >
                {step === "credentials" ? (
                  <>
                    <LoginProviders
                      disabled={isSubmitting || isServiceWaking}
                    />

                    <div className="space-y-1.5">
                      <label
                        htmlFor="email"
                        className="block text-xs font-medium text-foreground"
                      >
                        Work email
                      </label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={event => setEmail(event.target.value)}
                        required
                        aria-invalid={!!emailError}
                        aria-describedby={
                          emailError ? "email-error" : undefined
                        }
                        className="h-9 rounded-md text-sm"
                      />
                      {emailError && (
                        <p
                          id="email-error"
                          className="text-xs text-destructive"
                        >
                          {emailError}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <label
                          htmlFor="password"
                          className="block text-xs font-medium text-foreground"
                        >
                          Password
                        </label>
                        <Link
                          href="/forgot-password"
                          className="rounded-sm text-xs font-medium text-primary outline-none hover:text-info focus-visible:ring-2 focus-visible:ring-ring/30"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          value={password}
                          onChange={event => setPassword(event.target.value)}
                          className="h-9 rounded-md pr-10 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(visible => !visible)}
                          className="absolute right-1 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
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
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="login-otp"
                      className="block text-xs font-medium text-foreground"
                    >
                      {factor === "totp"
                        ? "Authenticator code"
                        : "Verification code"}
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
                        setOtp(
                          event.target.value.replace(/\D/g, "").slice(0, 6)
                        )
                      }
                      className="h-10 rounded-md text-center font-mono text-base tracking-[0.3em]"
                      aria-describedby="otp-help"
                      required
                    />
                    <div
                      id="otp-help"
                      className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
                    >
                      <span>Single-use code</span>
                      {factor === "email" ? (
                        <button
                          type="button"
                          disabled={resendIn > 0 || isSubmitting}
                          onClick={resendCode}
                          className="rounded-sm font-medium text-primary outline-none hover:text-info focus-visible:ring-2 focus-visible:ring-ring/30 disabled:text-text-disabled disabled:no-underline"
                        >
                          {resendIn > 0
                            ? `Resend in ${resendIn}s`
                            : "Resend code"}
                        </button>
                      ) : canFallBackToEmail ? (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={resendCode}
                          className="rounded-sm font-medium text-primary outline-none hover:text-info focus-visible:ring-2 focus-visible:ring-ring/30 disabled:text-text-disabled"
                        >
                          Email a code instead
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="raised"
                  disabled={submitDisabled}
                  className="mt-1 h-10 w-full rounded-md text-sm font-semibold"
                >
                  {isSubmitting
                    ? step === "credentials"
                      ? "Checking…"
                      : "Signing in…"
                    : isServiceWaking
                      ? `Starting service… ${serviceWakeSeconds}s`
                      : step === "credentials"
                        ? "Continue"
                        : "Verify and sign in"}
                </Button>

                {step === "code" ? (
                  <button
                    type="button"
                    onClick={returnToCredentials}
                    disabled={isSubmitting}
                    className="mx-auto flex items-center gap-1 rounded-sm pt-0.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
                  >
                    <ArrowLeft className="size-3" />
                    Use a different account
                  </button>
                ) : null}
              </form>
            </div>
          </div>
        </main>

        <LoginShowcase />
      </div>

      <LoginFaq />
      <LoginFooter />
    </div>
  );
}
