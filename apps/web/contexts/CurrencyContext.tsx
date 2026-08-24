"use client";

import Cookies from "js-cookie";
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

export interface CurrencyOption {
  code: string;
  symbol: string;
  name?: string;
}

interface CurrencyContextType {
  currency: string;
  symbol: string;
  /** Everything the picker can offer. Empty until the first fetch lands. */
  options: CurrencyOption[];
  /** Switches the display currency for every screen, and remembers it. */
  updateCurrency: (newCurrency: string, newSymbol?: string) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined
);

/**
 * The chosen display currency, remembered per browser.
 *
 * Kept in `localStorage` rather than only in the workspace settings so the
 * choice survives a reload and a navigation without waiting on a round trip —
 * the stored value is applied before the first paint of any amount.
 */
const STORAGE_KEY = "ralli-wolf-currency";

const FALLBACK: CurrencyOption = { code: "INR", symbol: "₹", name: "Indian Rupee" };

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
  const stored = readStored();
  const [currency, setCurrency] = useState(stored?.code ?? FALLBACK.code);
  const [symbol, setSymbol] = useState(stored?.symbol ?? FALLBACK.symbol);
  const [options, setOptions] = useState<CurrencyOption[]>([]);

  // Tell the formatter immediately, so amounts rendered before any effect runs
  // already use the remembered currency rather than flashing the default.
  setActiveCurrency(stored?.code ?? FALLBACK.code);

  const fetchGlobalCurrency = useCallback(async () => {
    // Only fetch if user is authenticated
    const token = Cookies.get("auth_token");
    if (!token) return;

    try {
      const [settings, currencies] = await Promise.all([
        settingsService.getGlobalSettings(),
        settingsService.getCurrencies(),
      ]);
      if (Array.isArray(currencies)) setOptions(currencies);

      // A currency the user picked here outranks the workspace default; the
      // workspace value is only the starting point for someone who has not
      // chosen.
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
      // Silently fail - use default currency
    }
  }, []);

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
          // A missing symbol is survivable; the ISO code still formats.
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
        // Not persisting is survivable; the session still switches.
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
      {/*
        Keyed on the currency so switching it re-renders every screen beneath.

        `formatMoney` is a plain function called in ~90 places, most of them in
        components that do not subscribe to this context — without a remount
        they would keep showing the previous currency until something else
        happened to re-render them. Remounting costs in-page state (an open
        filter, the current page of a table), which is an acceptable trade for a
        deliberate, infrequent action that is *supposed* to redraw every figure
        on screen.
      */}
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
