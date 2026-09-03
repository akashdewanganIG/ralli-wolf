"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

import {
  useGlobalSettings,
  useUpdateGlobalSetting,
} from "@/hooks/use-settings";
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
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <div className="relative">
          <Input
            id="discount-threshold"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            className="w-full pr-10"
            aria-label="Manager approval threshold"
            aria-invalid={!!validationMessage}
            aria-describedby="discount-threshold-help"
          />
          <span className="pointer-events-none absolute right-3 inset-y-0 my-auto h-fit text-sm font-medium text-muted-foreground">
            %
          </span>
        </div>

        <p
          id="discount-threshold-help"
          className="mt-1.5 text-xs text-muted-foreground"
        >
          Enter any value from 0 to 100.
        </p>
      </div>

      <Button
        type="button"
        onClick={handleSave}
        disabled={isPending || !hasChanged}
        className="w-full sm:w-auto"
      >
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
