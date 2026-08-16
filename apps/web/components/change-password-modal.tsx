"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";

import { authService } from "../lib/api/services";
import { toast } from "../lib/toast";

interface PasswordStrength {
  score: number;
  feedback: string[];
  isValid: boolean;
}

const MAX_PASSWORD_SCORE = 6;

function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 8) {
    feedback.push("Use at least 8 characters");
  } else if (password.length < 12) {
    score += 1;
  } else {
    score += 2;
  }

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push("Add an uppercase letter");

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push("Add a lowercase letter");

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push("Add a number");

  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else feedback.push("Add a special character");

  const lowerPassword = password.toLowerCase();
  if (
    ["12345", "password", "qwerty", "abc123", "111111"].some(pattern =>
      lowerPassword.includes(pattern)
    )
  ) {
    score -= 2;
    feedback.push("Avoid common words or number patterns");
  }

  const normalizedScore = Math.max(0, Math.min(MAX_PASSWORD_SCORE, score));
  return {
    score: normalizedScore,
    feedback,
    isValid: password.length >= 8 && normalizedScore >= 4,
  };
}

function getErrorMessage(error: unknown) {
  const candidate = error as {
    message?: string;
    response?: {
      data?: { error?: string; message?: string; details?: unknown };
    };
  };
  const title =
    candidate?.response?.data?.error ?? candidate?.response?.data?.message;
  const details = candidate?.response?.data?.details;

  if (title && typeof details === "string" && details !== title)
    return `${title}: ${details}`;
  return title ?? candidate?.message ?? "Unable to change your password";
}

export function ChangePasswordModal({
  open,
  onClose,
  forced = false,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * The account is still on its emailed password. The dialog cannot be
   * dismissed, because the API refuses every other route until it is replaced.
   */
  forced?: boolean;
  onChanged?: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordStrength = useMemo(
    () => (newPassword ? validatePasswordStrength(newPassword) : null),
    [newPassword]
  );
  const passwordsMatch = !confirmPassword || newPassword === confirmPassword;
  const strengthLabel = !passwordStrength
    ? ""
    : passwordStrength.score >= 5
      ? "Strong"
      : passwordStrength.score >= 3
        ? "Good"
        : "Weak";
  const strengthTone = !passwordStrength
    ? "bg-muted"
    : passwordStrength.score >= 5
      ? "bg-success"
      : passwordStrength.score >= 3
        ? "bg-warning"
        : "bg-error";

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || submitting || forced) return;
    reset();
    onClose();
  };

  const updateField = (setter: (value: string) => void) => (value: string) => {
    setError(null);
    setter(value);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Complete all three password fields.");
      return;
    }
    if (!passwordsMatch) {
      setError("The new passwords do not match.");
      return;
    }
    if (!passwordStrength?.isValid) {
      setError("Your new password does not meet the security requirements.");
      return;
    }

    try {
      setSubmitting(true);
      await authService.changePassword(currentPassword, newPassword);
      toast.success("Password updated successfully");
      reset();
      onChanged?.();
      onClose();
    } catch (submitError: unknown) {
      const message = getErrorMessage(submitError);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const visibilityButton = (
    shown: boolean,
    toggle: () => void,
    label: string
  ) => (
    <button
      type="button"
      onClick={toggle}
      className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
      aria-label={`${shown ? "Hide" : "Show"} ${label}`}
    >
      {shown ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!forced}
        onEscapeKeyDown={forced ? event => event.preventDefault() : undefined}
        onInteractOutside={forced ? event => event.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {forced ? "Set your own password" : "Change password"}
          </DialogTitle>
          <DialogDescription>
            {forced
              ? "You are signed in with the password that was emailed to you. Enter it once more, then choose a password only you know."
              : "Confirm your current password, then choose a strong password you do not use elsewhere."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-lg border border-error/20 bg-error-surface px-3.5 py-3 text-sm text-error-foreground"
          >
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={event =>
                  updateField(setCurrentPassword)(event.target.value)
                }
                autoComplete="current-password"
                autoFocus
                required
                disabled={submitting}
                className="pr-10"
              />
              {visibilityButton(
                showCurrentPassword,
                () => setShowCurrentPassword(value => !value),
                "current password"
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={event =>
                  updateField(setNewPassword)(event.target.value)
                }
                autoComplete="new-password"
                minLength={8}
                required
                disabled={submitting}
                className="pr-10"
                aria-invalid={
                  passwordStrength ? !passwordStrength.isValid : undefined
                }
                aria-describedby={
                  passwordStrength
                    ? "password-strength"
                    : "password-requirements"
                }
              />
              {visibilityButton(
                showNewPassword,
                () => setShowNewPassword(value => !value),
                "new password"
              )}
            </div>

            {passwordStrength ? (
              <div id="password-strength" className="space-y-2 pt-1">
                <div className="flex items-center gap-3">
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
                    role="progressbar"
                    aria-label="Password strength"
                    aria-valuemin={0}
                    aria-valuemax={MAX_PASSWORD_SCORE}
                    aria-valuenow={passwordStrength.score}
                  >
                    <div
                      className={`h-full rounded-full transition-[width,background-color] duration-200 ${strengthTone}`}
                      style={{
                        width: `${(passwordStrength.score / MAX_PASSWORD_SCORE) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="min-w-10 text-right text-xs font-medium text-muted-foreground">
                    {strengthLabel}
                  </span>
                </div>
                {passwordStrength.feedback.length > 0 ? (
                  <ul className="grid gap-1 text-xs leading-4 text-muted-foreground sm:grid-cols-2">
                    {passwordStrength.feedback.slice(0, 4).map(message => (
                      <li key={message}>• {message}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-success-foreground">
                    <CheckCircle2 className="size-3.5" /> All password
                    requirements are met.
                  </p>
                )}
              </div>
            ) : (
              <p
                id="password-requirements"
                className="text-xs leading-4 text-muted-foreground"
              >
                Use 8+ characters with upper and lowercase letters, a number,
                and a symbol.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={event =>
                  updateField(setConfirmPassword)(event.target.value)
                }
                autoComplete="new-password"
                required
                disabled={submitting}
                className="pr-10"
                aria-invalid={!passwordsMatch}
                aria-describedby={
                  !passwordsMatch ? "password-match-error" : undefined
                }
              />
              {visibilityButton(
                showConfirmPassword,
                () => setShowConfirmPassword(value => !value),
                "password confirmation"
              )}
            </div>
            {!passwordsMatch && (
              <p
                id="password-match-error"
                className="text-xs text-error-foreground"
              >
                The passwords do not match.
              </p>
            )}
          </div>

          {/*
            A user who signed in with an email code may never have received the
            generated password, so "current password" is unanswerable for them.
            The reset flow proves the same thing (control of the inbox) and
            clears the same flag, so it is the way out rather than a dead end.
          */}
          {forced && (
            <p className="text-xs leading-4 text-muted-foreground">
              Never received that password?{" "}
              <Link
                href="/forgot-password"
                className="font-medium text-primary underline underline-offset-4"
              >
                Reset it with an email code
              </Link>{" "}
              instead.
            </p>
          )}

          <DialogFooter className="pt-1">
            {!forced && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                submitting ||
                !passwordStrength?.isValid ||
                !passwordsMatch ||
                !confirmPassword
              }
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? "Updating…" : "Update password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
