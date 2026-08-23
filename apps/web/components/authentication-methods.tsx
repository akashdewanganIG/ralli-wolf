"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, LockKeyhole, Mail } from "@repo/ui/icons";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { authService } from "@/lib/api/services";
import type {
  ApiError,
  AuthMethodName,
  AuthMethodsSummary,
  AuthMethodStatus,
  TotpEnrolment,
} from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { AuthMethodSetupModal } from "@/components/auth-method-setup-modal";

const METHOD_COPY: Record<
  AuthMethodName,
  { title: string; description: string; Icon: typeof KeyRound }
> = {
  password: {
    title: "Password",
    description: "The first step of every sign-in. Always required.",
    Icon: LockKeyhole,
  },
  email: {
    title: "Email code",
    description: "A 6-digit code sent to your registered address.",
    Icon: Mail,
  },
  totp: {
    title: "Authenticator app",
    description:
      "Time-based codes from Ente Auth, Google Authenticator, Microsoft Authenticator or any compatible app.",
    Icon: KeyRound,
  },
};

/** Shared width for the action column, so every row ends the same way. */
const ACTION_WIDTH = "w-24";

function asApiError(error: unknown): ApiError | null {
  return error && typeof error === "object" && "status" in error
    ? (error as ApiError)
    : null;
}

/** Turns a failure into copy that names the cause; never silently no-ops. */
function reportFailure(error: unknown, fallbackTitle: string) {
  const apiError = asApiError(error);
  if (!apiError) {
    toast.error("Could not reach the server", {
      description: "Check your connection and try again.",
    });
    return;
  }
  switch (apiError.code) {
    case "CONFLICT":
      // Covers both "already enabled" and the two-method refusal; the server
      // sends the specific sentence.
      toast.warning("Change not applied", { description: apiError.message });
      return;
    case "INVALID_OTP":
      toast.error("That code is not right", {
        description:
          typeof apiError.attemptsRemaining === "number" &&
          apiError.attemptsRemaining > 0
            ? `${apiError.attemptsRemaining} attempts left before you need a new code.`
            : apiError.message,
      });
      return;
    case "OTP_EXPIRED":
      toast.error("That code has expired", {
        description: "Send yourself a new one and try again.",
      });
      return;
    case "OTP_ATTEMPTS_EXCEEDED":
      toast.error("Too many incorrect codes", {
        description: "Request a new code to continue.",
      });
      return;
    case "OTP_DELIVERY_FAILED":
      toast.error("Could not send the code", {
        description: "The email did not go out. Try again in a moment.",
      });
      return;
    default:
      break;
  }
  if (apiError.status === 429) {
    toast.warning("Too many requests", {
      description: "Wait a few minutes before trying again.",
    });
    return;
  }
  if (apiError.status === 403) {
    toast.warning("Not allowed", { description: apiError.message });
    return;
  }
  toast.error(fallbackTitle, {
    description: apiError.message || "Please try again.",
  });
}

/**
 * One method: what it is, what it does, and what you can do about it.
 *
 * Flat, and deliberately without a state label. The button already says where
 * the method stands — "Turn off" only appears on something that is on — so a
 * badge beside it was the same fact twice, in the row's loudest element.
 */
function MethodRow({
  status,
  actions,
}: {
  status: AuthMethodStatus;
  actions?: React.ReactNode;
}) {
  const { title, description, Icon } = METHOD_COPY[status.method];

  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0",
          status.enabled && status.verified
            ? "text-foreground"
            : "text-muted-foreground"
        )}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-5 text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}

export function AuthenticationMethods() {
  const [summary, setSummary] = useState<AuthMethodsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyMethod, setBusyMethod] = useState<AuthMethodName | null>(null);

  /** Which enrolment dialog is open, if any. */
  const [setupMethod, setSetupMethod] = useState<AuthMethodName | null>(null);
  const [enrolment, setEnrolment] = useState<TotpEnrolment | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const load = useCallback(async () => {
    try {
      setSummary(await authService.getAuthMethods());
    } catch (error) {
      reportFailure(error, "Could not load your sign-in methods");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(
      () => setResendIn(s => Math.max(0, s - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [resendIn]);

  const byMethod = useMemo(() => {
    const map = new Map<AuthMethodName, AuthMethodStatus>();
    summary?.methods.forEach(m => map.set(m.method, m));
    return map;
  }, [summary]);

  const atMinimum = !!summary && summary.activeCount <= summary.minimumRequired;

  // ------------------------------------------------------------ actions --
  const closeSetup = () => {
    setSetupMethod(null);
    setEnrolment(null);
    setResendIn(0);
  };

  const startTotp = async () => {
    setBusyMethod("totp");
    try {
      // Only open the dialog once there is a QR to show in it.
      setEnrolment(await authService.startTotpSetup());
      setSetupMethod("totp");
    } catch (error) {
      reportFailure(error, "Could not start authenticator setup");
    } finally {
      setBusyMethod(null);
    }
  };

  const confirmTotp = async (code: string) => {
    setBusyMethod("totp");
    try {
      // Only trust the server's word that the method is now active.
      setSummary(await authService.verifyTotpSetup(code));
      closeSetup();
      toast.success("Authenticator app enabled", {
        description:
          "You will be asked for a code from your app when signing in.",
      });
    } catch (error) {
      reportFailure(error, "Could not verify that code");
    } finally {
      setBusyMethod(null);
    }
  };

  const sendEmailCode = async (resend = false) => {
    setBusyMethod("email");
    try {
      await authService.sendAuthEmailCode();
      setSetupMethod("email");
      setResendIn(30);
      toast.info(resend ? "New code sent" : "Verification code sent", {
        description:
          "Check your inbox for a 6-digit code. It expires in 10 minutes.",
      });
    } catch (error) {
      reportFailure(error, "Could not send the code");
    } finally {
      setBusyMethod(null);
    }
  };

  const confirmEmail = async (code: string) => {
    setBusyMethod("email");
    try {
      setSummary(await authService.verifyAuthEmailCode(code));
      closeSetup();
      toast.success("Email codes enabled", {
        description: "We will email you a code when signing in.",
      });
    } catch (error) {
      reportFailure(error, "Could not verify that code");
    } finally {
      setBusyMethod(null);
    }
  };

  const disable = async (method: AuthMethodName) => {
    // The server refuses this too, but it is a rule the user can be told about
    // before spending a round-trip on it. The banner that used to state it
    // standing is gone: a warning that is always on screen stops being read.
    if (atMinimum) {
      toast.warning("Keep at least two ways to sign in", {
        description: `Turning off ${METHOD_COPY[method].title.toLowerCase()} would leave you with ${summary ? summary.minimumRequired - 1 : 1}. Set another method up first, then turn this one off.`,
      });
      return;
    }

    setBusyMethod(method);
    try {
      setSummary(await authService.disableAuthMethod(method));
      toast.success(`${METHOD_COPY[method].title} turned off`, {
        description: "It will no longer be used to sign in.",
      });
    } catch (error) {
      reportFailure(error, "Could not turn that method off");
      // The server returns the authoritative state with its refusal.
      void load();
    } finally {
      setBusyMethod(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
        Loading sign-in methods…
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="px-3 py-4 text-sm text-muted-foreground">
        Sign-in methods are unavailable right now.
      </div>
    );
  }

  const password = byMethod.get("password");
  const email = byMethod.get("email");
  const totp = byMethod.get("totp");

  /**
   * The one control every optional method shows, in whichever state it is.
   *
   * Fixed width, so "Set up" and "Turn off" are the same size and the column
   * of actions has one straight left edge instead of ragging with the label.
   */
  const methodAction = (
    status: AuthMethodStatus | undefined,
    onSetUp: () => void
  ) => {
    if (!status) return null;
    return status.enabled ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={ACTION_WIDTH}
        disabled={busyMethod !== null}
        onClick={() => disable(status.method)}
      >
        Turn off
      </Button>
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={ACTION_WIDTH}
        disabled={busyMethod !== null}
        onClick={onSetUp}
      >
        {busyMethod === status.method ? "Opening…" : "Set up"}
      </Button>
    );
  };

  return (
    <div>
      {password ? (
        <MethodRow
          status={password}
          actions={
            <span
              className={cn(
                ACTION_WIDTH,
                "text-center text-xs text-muted-foreground"
              )}
            >
              Always on
            </span>
          }
        />
      ) : null}

      {email ? (
        <MethodRow
          status={email}
          actions={methodAction(email, () => void sendEmailCode(false))}
        />
      ) : null}

      {totp ? (
        <MethodRow
          status={totp}
          actions={methodAction(totp, () => void startTotp())}
        />
      ) : null}

      <AuthMethodSetupModal
        method={setupMethod}
        enrolment={enrolment}
        busy={busyMethod !== null}
        resendIn={resendIn}
        onResend={() => void sendEmailCode(true)}
        onCancel={closeSetup}
        onVerify={code =>
          setupMethod === "totp" ? confirmTotp(code) : confirmEmail(code)
        }
      />
    </div>
  );
}
