"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Check, Copy } from "@repo/ui/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";

import type { AuthMethodName, TotpEnrolment } from "@/lib/api/types";
import { toast } from "@/lib/toast";

const COPY = {
  totp: {
    title: "Set up authenticator app",
    description:
      "Scan the code with Ente Auth, Google Authenticator, Microsoft Authenticator or any compatible app, then enter the 6-digit code it shows.",
    codeLabel: "Code from your authenticator app",
    confirm: "Verify and enable",
  },
  email: {
    title: "Turn on email codes",
    description:
      "We have emailed a 6-digit code to your registered address. Enter it below to switch this method on.",
    codeLabel: "Code we emailed you",
    confirm: "Verify and enable",
  },
} as const;

export function AuthMethodSetupModal({
  method,
  enrolment,
  busy,
  resendIn,
  onResend,
  onCancel,
  onVerify,
}: {
  method: AuthMethodName | null;
  enrolment: TotpEnrolment | null;
  busy: boolean;
  resendIn: number;
  onResend: () => void;
  onCancel: () => void;
  onVerify: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");

  useEffect(() => {
    if (method) setCode("");
  }, [method]);

  const open = method !== null && method !== "password";
  const copy = method === "totp" || method === "email" ? COPY[method] : null;

  const copyKey = async () => {
    if (!enrolment) return;
    try {
      await navigator.clipboard.writeText(
        enrolment.manualKey.replace(/\s/g, "")
      );
      toast.success("Setup key copied");
    } catch {
      toast.error("Could not copy", {
        description: "Select the key and copy it manually.",
      });
    }
  };

  if (!copy) return null;

  return (
    <Dialog open={open} onOpenChange={next => (next ? undefined : onCancel())}>
      <DialogContent className="gap-0 overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {method === "totp" && enrolment ? (
            <div className="space-y-3">
              <div className="flex justify-center">
                <Image
                  src={enrolment.qrCodeDataUrl}
                  alt="Authenticator setup QR code"
                  width={168}
                  height={168}
                  unoptimized
                  className="rounded-lg border border-border bg-white p-2"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totp-manual-key">
                  Or enter this key by hand
                </Label>
                <div className="flex items-center gap-1.5">
                  <code
                    id="totp-manual-key"
                    className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface-subtle px-2.5 py-2 font-mono text-xs text-foreground"
                  >
                    {enrolment.manualKey}
                  </code>
                  <CopyKeyButton onCopy={copyKey} />
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="auth-setup-code">{copy.codeLabel}</Label>
            <Input
              id="auth-setup-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={event =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="text-center font-mono text-base tracking-[0.35em]"
            />
            {method === "email" ? (
              <button
                type="button"
                onClick={onResend}
                disabled={resendIn > 0 || busy}
                className="rounded-sm text-xs font-medium text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring/30 disabled:text-text-disabled disabled:no-underline"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            ) : null}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={code.length !== 6 || busy}
            onClick={() => void onVerify(code)}
          >
            {busy ? "Verifying…" : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyKeyButton({ onCopy }: { onCopy: () => Promise<void> }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Copy setup key"
      className="size-9 shrink-0"
      onClick={async () => {
        await onCopy();
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
