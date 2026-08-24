"use client";

import * as React from "react";

/** What the user chose. `system` defers to the OS. */
export type Theme = "light" | "dark" | "system";
/** What is actually painted. `system` has already been resolved away. */
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "ralli-wolf-theme";

interface ThemeContextValue {
  /** The user's choice, including `system`. */
  theme: Theme;
  /** The painted result — never `system`. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

/**
 * Following the OS is the default.
 *
 * A first-time visitor gets whatever their machine is already set to, which is
 * the setting they have effectively already made everywhere else. An explicit
 * light or dark choice overrides it and sticks until they change it again.
 */
const DEFAULT_THEME: Theme = "system";

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined
);

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Runs before first paint to stamp `.dark` on <html>.
 *
 * Inlined in the document head so the class is already correct when the first
 * frame renders — without it a dark-mode user sees a white flash on every
 * navigation that touches the document.
 *
 * An absent or `system` preference consults `prefers-color-scheme` here, at the
 * same moment and by the same rule the React provider will use, so the two can
 * never disagree on the first frame.
 *
 * Kept in sync with `resolve`/`applyTheme` below; all three must agree.
 */
export const themeInitScript = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY
)});var d=s==="dark"||((s===null||s==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

/** The OS preference, or `light` where it cannot be read (SSR). */
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
  // Starts light so the server and the first client render agree; the effect
  // below corrects it before paint is committed.
  const [resolvedTheme, setResolvedTheme] =
    React.useState<ResolvedTheme>("light");

  // Adopt whatever the pre-paint script already decided.
  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private-mode browsers can throw on access; fall back to the default.
    }
    const next = isTheme(stored) ? stored : defaultTheme;
    const painted = resolve(next);
    setThemeState(next);
    setResolvedTheme(painted);
    applyTheme(painted);
  }, [defaultTheme]);

  // While following the OS, track it live: a machine that switches to dark at
  // sunset should take the app with it without a reload.
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
      // Not persisting is survivable; the session still switches.
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
