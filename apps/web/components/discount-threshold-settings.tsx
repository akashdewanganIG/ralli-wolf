"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";

import { useGlobalSettings, useUpdateGlobalSetting } from "@/hooks/useSettings";
import { toast } from "@/lib/toast";
import { Alert } from "@repo/ui/components/ui/alert";
import { Skeleton } from "@/components/skeletons";

export default function DiscountThresholdSettings() {
  const { data: settings, isLoading, isError } = useGlobalSettings();
  const { mutateAsync: updateSetting, isPending } = useUpdateGlobalSetting();
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (settings?.OPPORTUNITY_DISCOUNT_THRESHOLD !== undefined) {
      setInputValue(settings.OPPORTUNITY_DISCOUNT_THRESHOLD);
    }
  }, [settings?.OPPORTUNITY_DISCOUNT_THRESHOLD]);

  const validationMessage = useMemo(() => {
    if (!inputValue.trim()) return "Enter a threshold between 0 and 100.";

    const parsed = Number(inputValue);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return "Threshold must be between 0 and 100.";
    }

    return null;
  }, [inputValue]);

  const hasChanged =
    settings?.OPPORTUNITY_DISCOUNT_THRESHOLD !== undefined &&
    Number(inputValue) !== Number(settings.OPPORTUNITY_DISCOUNT_THRESHOLD);

  const handleSave = async () => {
    if (validationMessage) return;

    try {
      await updateSetting({
        key: "OPPORTUNITY_DISCOUNT_THRESHOLD",
        value: String(Number(inputValue)),
      });
      toast.success("Discount approval threshold updated");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to update threshold";
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <div
        className="space-y-3"
        role="status"
        aria-label="Loading sales controls"
      >
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert tone="error" title="Unable to load sales settings">
        Sales settings could not be loaded. Please refresh and try again.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="discount-threshold">Manager approval threshold</Label>
        <p className="text-sm leading-5 text-muted-foreground">
          Discounts above this percentage require approval before the
          opportunity can proceed.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="w-full sm:w-48">
          <div className="relative">
            <Input
              id="discount-threshold"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={inputValue}
              onChange={event => setInputValue(event.target.value)}
              className="pr-10"
              aria-invalid={!!validationMessage}
              aria-describedby={
                validationMessage
                  ? "discount-threshold-error"
                  : "discount-threshold-help"
              }
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
              %
            </span>
          </div>
          {validationMessage ? (
            <p
              id="discount-threshold-error"
              className="mt-1.5 text-xs text-error-foreground"
            >
              {validationMessage}
            </p>
          ) : (
            <p
              id="discount-threshold-help"
              className="mt-1.5 text-xs text-muted-foreground"
            >
              Enter any value from 0 to 100.
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={isPending || !!validationMessage || !hasChanged}
          className="w-full sm:w-auto"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
