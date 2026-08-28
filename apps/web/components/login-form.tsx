"use client";

import { ArrowLeft, Eye, EyeOff } from "@repo/ui/icons";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";
import ralliWolfLogo from "../app/assets/images/logos/ralli-wolf-logo.png";
import { useAuth } from "../contexts/AuthContext";
import { isSignedIn, type ApiError } from "../lib/api/types";
import { validateEmailBasic } from "../lib/validation";
import { toast } from "@/lib/toast";
import LoginShowcase from "./LoginShowcase";
import LoginProviders from "./LoginProviders";
import LoginFaq from "./LoginFaq";
import LoginFooter from "./LoginFooter";

/**
 * Sign-in has one step or two, and only the server knows which.
 *
 * An account with just a password is signed in by `/login` itself. An account
 * with a second factor gets a challenge to confirm. An account that turned its
 * password off starts at that challenge instead — which is why the password
 * field is optional here.
 *
 * The form must therefore read what came back rather than assume a challenge:
 * assuming one is what put an authenticator prompt in front of accounts that
 * had never enrolled an authenticator.
 */
type Step = "credentials" | "code";
type Factor = "totp" | "email";

const RESEND_COOLDOWN_SECONDS = 30;

function asApiError(error: unknown): ApiError | null {
  return error && typeof error === "object" && "status" in error
    ? (error as ApiError)
    : null;
}

/**
 * Turns a sign-in failure into copy that names what the user can act on.
 *
 * Bad credentials stay deliberately vague: the API will not say whether the
 * email or the password was wrong, because that would let anyone test which
 * addresses hold accounts. Every other failure is named precisely.
 */
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
        "This account is temporarily locked out. Wait a few minutes before trying again.",
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

/** Same idea for the second step, where the failure modes are all about the code. */
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
  const [resendIn, setResendIn] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);
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
      const result = await login({ email: normalizedEmail, password });

      // An account whose only sign-in method is its password is already
      // signed in at this point — there is no second step to show. Going to
      // the code screen anyway is what made an authenticator prompt appear
      // for accounts that have never enrolled one.
      if (isSignedIn(result)) {
        toast.success("Welcome back", {
          description: "You are signed in to Ralli Wolf.",
        });
        router.replace(
          result.user.role?.toUpperCase() === "SALES" ? "/sales-user" : "/"
        );
        return;
      }

      const challenge = result;
      setMfaToken(challenge.mfaToken);
      setMaskedEmail(challenge.maskedEmail);
      setFactor(challenge.factor);
      setAvailableFactors(challenge.availableFactors ?? []);
      setOtp("");
      setStep("code");
      // Only an emailed code has a delivery to wait on.
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
    (step === "credentials" ? !!emailError || !email : otp.length !== 6);

  const canFallBackToEmail =
    step === "code" && factor === "totp" && availableFactors.includes("email");

  return (
    <div
      className={cn(
        // `login-page` scopes the page's own surface tokens; everything
        // above the footer shares one flat colour.
        "login-page flex min-h-svh w-full flex-col bg-[var(--login-bg)]",
        className
      )}
      {...props}
    >
      {/* Brand top-left, theme switch top-right, both clear of the form. */}

      {/* Form on the left, video panel on the right. The panel is portrait,
          so the right column is the narrower of the two. */}
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

          <div className="my-auto w-full lg:pl-12">
            <div className="mx-auto w-full max-w-[22rem] pt-10">
              <div>
                <h1 className="font-brand text-xl tracking-tight text-foreground">
                  {step === "credentials"
                    ? "Partner portal"
                    : "Confirm it is you"}
                </h1>
                {/* Only the second factor gets a sub-line, and only because it
                    has to say where the code went. The first step stands on the
                    heading alone. */}
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
                    <LoginProviders disabled={isSubmitting} />

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
