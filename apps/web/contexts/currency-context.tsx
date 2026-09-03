"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { setActiveCurrency } from "../lib/utils/decimal";
import { settingsService } from "../lib/api/services";
import { useAuth } from "./auth-context";

export interface CurrencyOption {
  code: string;
  symbol: string;
  name?: string;
}

interface CurrencyContextType {
  currency: string;
  symbol: string;

  options: CurrencyOption[];

  updateCurrency: (newCurrency: string, newSymbol?: string) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined
);

const STORAGE_KEY = "ralli-wolf-currency";

const FALLBACK: CurrencyOption = {
  code: "INR",
  symbol: "₹",
  name: "Indian Rupee",
};

function readStored(): CurrencyOption | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CurrencyOption;
    return parsed?.code ? parsed : null;
  } catch {
    return null;
  }
}

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const stored = readStored();
  const [currency, setCurrency] = useState(stored?.code ?? FALLBACK.code);
  const [symbol, setSymbol] = useState(stored?.symbol ?? FALLBACK.symbol);
  const [options, setOptions] = useState<CurrencyOption[]>([]);

  setActiveCurrency(stored?.code ?? FALLBACK.code);

  const fetchGlobalCurrency = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const [settings, currencies] = await Promise.all([
        settingsService.getGlobalSettings(),
        settingsService.getCurrencies(),
      ]);
      if (Array.isArray(currencies)) setOptions(currencies);

      if (readStored()) return;

      if (settings.defaultCurrency) {
        setCurrency(settings.defaultCurrency);
        setActiveCurrency(settings.defaultCurrency);
        const info = currencies.find(
          (c: { code: string }) => c.code === settings.defaultCurrency
        );
        if (info) setSymbol(info.symbol);
      }
    } catch {
      return;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchGlobalCurrency();
  }, [fetchGlobalCurrency]);

  const updateCurrency = useCallback(
    async (newCurrency: string, newSymbol?: string) => {
      let resolvedSymbol = newSymbol;
      if (!resolvedSymbol) {
        try {
          const currencies = await settingsService.getCurrencies();
          resolvedSymbol = currencies.find(c => c.code === newCurrency)?.symbol;
        } catch {
          resolvedSymbol = undefined;
        }
      }
      setCurrency(newCurrency);
      setActiveCurrency(newCurrency);
      if (resolvedSymbol) setSymbol(resolvedSymbol);
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ code: newCurrency, symbol: resolvedSymbol })
        );
      } catch {
        return;
      }
    },
    []
  );

  const value = useMemo(
    () => ({ currency, symbol, options, updateCurrency }),
    [currency, symbol, options, updateCurrency]
  );

  return (
    <CurrencyContext.Provider value={value}>
      <div key={currency} className="contents">
        {children}
      </div>
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
};
