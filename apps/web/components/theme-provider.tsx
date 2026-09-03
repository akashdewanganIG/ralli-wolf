"use client";

import * as React from "react";

export type Theme = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "ralli-wolf-theme";

interface ThemeContextValue {
  theme: Theme;

  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const DEFAULT_THEME: Theme = "system";

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined
);

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export const themeInitScript = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY
)});var d=s==="dark"||((s===null||s==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === "system" ? systemTheme() : theme;
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);

  const [resolvedTheme, setResolvedTheme] =
    React.useState<ResolvedTheme>("light");

  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    const next = isTheme(stored) ? stored : defaultTheme;
    const painted = resolve(next);
    setThemeState(next);
    setResolvedTheme(painted);
    applyTheme(painted);
  }, [defaultTheme]);

  React.useEffect(() => {
    if (theme !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const painted = systemTheme();
      setResolvedTheme(painted);
      applyTheme(painted);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      return;
    }
    const painted = resolve(next);
    setResolvedTheme(painted);
    applyTheme(painted);
  }, []);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return context;
}
