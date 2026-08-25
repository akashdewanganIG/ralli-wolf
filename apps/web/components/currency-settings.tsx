"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "@repo/ui/icons";
import { Alert } from "@repo/ui/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";

import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateGlobalSetting } from "@/hooks/useSettings";
import { settingsService } from "@/lib/api/services";
import { toast } from "@/lib/toast";
import { Skeleton } from "@/components/skeletons";
import { distinctCurrencySymbol } from "@/lib/utils/decimal";

interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

export default function CurrencySettings() {
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { currency, updateCurrency } = useCurrency();
  const { user } = useAuth();
  const { mutateAsync: updateSetting, isPending } = useUpdateGlobalSetting();
  const canManageWorkspace = user?.role?.toUpperCase() === "ADMIN";

  useEffect(() => {
    let isMounted = true;

    const fetchCurrencies = async () => {
      try {
        const availableCurrencies = await settingsService.getCurrencies();
        if (isMounted) setCurrencies(availableCurrencies);
      } catch {
        if (isMounted) setLoadError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchCurrencies();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCurrencyChange = async (newCurrency: string) => {
    if (newCurrency === currency) return;

    try {
      await updateSetting({ key: "defaultCurrency", value: newCurrency });
      const selected = currencies.find(option => option.code === newCurrency);
      await updateCurrency(newCurrency, selected?.symbol);
      toast.success("Workspace currency updated");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to update currency";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-2">
      {isLoading ? (
        <Skeleton className="h-10 w-full rounded-lg" />
      ) : loadError ? (
        <Alert tone="error">Currencies could not be loaded.</Alert>
      ) : (
        <Select
          value={currency}
          onValueChange={handleCurrencyChange}
          disabled={isPending || !canManageWorkspace}
        >
          <SelectTrigger
            id="workspace-currency"
            aria-label="Workspace currency"
            className="w-full"
          >
            <SelectValue placeholder="Select a currency" />
          </SelectTrigger>
          <SelectContent>
            {currencies.map(option => (
              <SelectItem key={option.code} value={option.code}>
                {option.code} · {option.name}
                {distinctCurrencySymbol(option.code, option.symbol)
                  ? ` (${distinctCurrencySymbol(option.code, option.symbol)})`
                  : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Reads as a caption under the control it describes. It used to be a
          second grid column, which is what held the select down to 22rem. */}
      <div className="flex items-start gap-2 pt-0.5 text-xs leading-5 text-muted-foreground">
        {isPending ? null : (
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
        )}
        <span>
          {isPending
            ? "Saving your selection…"
            : canManageWorkspace
              ? "Applied to prices, quotes and reports."
              : "Only a system administrator can change this workspace setting."}
        </span>
      </div>
    </div>
  );
}
