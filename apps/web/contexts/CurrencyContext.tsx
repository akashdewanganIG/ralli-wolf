"use client";

import Cookies from "js-cookie";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { settingsService } from "../lib/api/services";

interface CurrencyContextType {
  currency: string;
  symbol: string;
  updateCurrency: (newCurrency: string, newSymbol?: string) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined
);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrency] = useState("INR");
  const [symbol, setSymbol] = useState("₹");

  const fetchGlobalCurrency = useCallback(async () => {
    // Only fetch if user is authenticated
    const token = Cookies.get("auth_token");
    if (!token) return;

    try {
      const [settings, currencies] = await Promise.all([
        settingsService.getGlobalSettings(),
        settingsService.getCurrencies(),
      ]);
      if (settings.defaultCurrency) {
        setCurrency(settings.defaultCurrency);
        const currencyInfo = currencies.find(
          (c: { code: string }) => c.code === settings.defaultCurrency
        );
        if (currencyInfo) {
          setSymbol(currencyInfo.symbol);
        }
      }
    } catch {
      // Silently fail - use default currency
    }
  }, []);

  useEffect(() => {
    fetchGlobalCurrency();
  }, [fetchGlobalCurrency]);

  const updateCurrency = async (newCurrency: string, newSymbol?: string) => {
    setCurrency(newCurrency);
    if (newSymbol) {
      setSymbol(newSymbol);
      return;
    }
    try {
      const currencies = await settingsService.getCurrencies();
      const currencyInfo = currencies.find(c => c.code === newCurrency);
      if (currencyInfo) {
        setSymbol(currencyInfo.symbol);
      }
    } catch (error) {
      console.error("Failed to fetch currencies:", error);
    }
  };

  return (
    <CurrencyContext.Provider value={{ currency, symbol, updateCurrency }}>
      {children}
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
