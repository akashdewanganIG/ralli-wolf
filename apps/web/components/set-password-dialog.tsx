"use client";

import { useEffect, useState } from "react";
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

const MIN_LENGTH = 8;

/**
 * Chooses a password and turns password sign-in on.
 *
 * Asks for the value twice because there is nothing to check it against: the
 * account may have had no password at all, so a typo would otherwise become
 * the password and only surface at the next sign-in.
 */
export function SetPasswordDialog({
  open,
  busy,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (!open) {
      setPassword("");
      setConfirm("");
    }
  }, [open]);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = password.length >= MIN_LENGTH && password === confirm && !busy;

  return (
    <Dialog open={open} onOpenChange={next => (next ? null : onCancel())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Turn on password sign-in</DialogTitle>
          <DialogDescription>
            Choose a password of at least {MIN_LENGTH} characters. It becomes
            the first step of your next sign-in.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault();
            if (ready) onSubmit(password);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              disabled={busy}
              onChange={event => setPassword(event.target.value)}
            />
            {tooShort ? (
              <p className="text-xs text-destructive">
                Use at least {MIN_LENGTH} characters.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              disabled={busy}
              onChange={event => setConfirm(event.target.value)}
            />
            {mismatch ? (
              <p className="text-xs text-destructive">
                These two do not match.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!ready}>
              {busy ? "Saving…" : "Turn on"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
