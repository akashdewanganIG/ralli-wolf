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
import { SetPasswordDialog } from "@/components/set-password-dialog";

const METHOD_COPY: Record<
  AuthMethodName,
  { title: string; description: string; Icon: typeof KeyRound }
> = {
  password: {
    title: "Password",
    description: "A password you enter to begin signing in.",
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

const ACTION_WIDTH = "w-24";

function asApiError(error: unknown): ApiError | null {
  return error && typeof error === "object" && "status" in error
    ? (error as ApiError)
    : null;
}

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
  const [passwordOpen, setPasswordOpen] = useState(false);

  const closeSetup = () => {
    setSetupMethod(null);
    setEnrolment(null);
    setResendIn(0);
  };

  const startTotp = async () => {
    setBusyMethod("totp");
    try {
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

  const setPassword = async (newPassword: string) => {
    setBusyMethod("password");
    try {
      const updated = await authService.setAuthPassword(newPassword);
      const { sessionToken: _sessionToken, ...summary } = updated;
      setSummary(summary);
      setPasswordOpen(false);
      toast.success("Password sign-in turned on", {
        description: "Your next sign-in will start with this password.",
      });
    } catch (error) {
      reportFailure(error, "Could not turn password sign-in on");
    } finally {
      setBusyMethod(null);
    }
  };

  const disable = async (method: AuthMethodName) => {
    if (atMinimum) {
      toast.warning("Keep at least one way to sign in", {
        description: `${METHOD_COPY[method].title} is the only method left on your account. Set another one up first, then turn this one off.`,
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
          actions={methodAction(password, () => setPasswordOpen(true))}
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

      <SetPasswordDialog
        open={passwordOpen}
        busy={busyMethod === "password"}
        onCancel={() => setPasswordOpen(false)}
        onSubmit={pw => void setPassword(pw)}
      />

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
