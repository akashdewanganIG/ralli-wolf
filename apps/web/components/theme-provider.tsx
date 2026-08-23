"use client";

import * as React from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ralli-wolf-theme";

interface ThemeContextValue {
  /** What the user chose. */
  theme: Theme;
  /**
   * What is actually painted right now. Identical to `theme` — kept as its own
   * field so callers that only care about the painted result (the toast
   * surface, for one) do not have to know how the choice is stored.
   */
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
}

/**
 * Dark is the product's default. A first-time visitor gets it without having
 * chosen anything, and the OS preference is deliberately not consulted: the
 * app is a single, deliberate surface rather than one that changes character
 * with whatever the machine is set to.
 */
const DEFAULT_THEME: Theme = "dark";

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined
);

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Runs before first paint to stamp `.dark` on <html>.
 *
 * Inlined in the document head so the class is already correct when the first
 * frame renders — without it a dark-mode user sees a white flash on every
 * navigation that touches the document.
 *
 * Anything other than a stored "light" resolves to dark, which also retires
 * the "system" value earlier builds could have written without needing a
 * migration step.
 *
 * Kept in sync with `applyTheme` below; both must set the same class.
 */
export const themeInitScript = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY
)});var d=s!=="light";document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);

  // Adopt whatever the pre-paint script already decided, so the first client
  // render agrees with the server-rendered markup.
  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private-mode browsers can throw on access; fall back to the default.
    }
    const next = isTheme(stored) ? stored : defaultTheme;
    setThemeState(next);
    applyTheme(next);
  }, [defaultTheme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisting is survivable; the session still switches.
    }
    applyTheme(next);
  }, []);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme: theme, setTheme }),
    [theme, setTheme]
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
