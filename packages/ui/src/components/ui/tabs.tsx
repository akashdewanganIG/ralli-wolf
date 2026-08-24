"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

type TabsContextValue = {
  activeValue: string;
  handleValueChange: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

/**
 * The tab state, or `null` outside a `<Tabs>`.
 *
 * Nullable so `CategorySwitcher` can tell "inside a Tabs, adopt its state" from
 * "standalone, use my own props" instead of silently binding to a dummy value.
 */
export function useTabsOptional(): TabsContextValue | null {
  return React.useContext(TabsContext);
}

function useTabs(): TabsContextValue {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("useTabs must be used within <Tabs>");
  }
  return context;
}

type TabsProps = {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
};

/**
 * Holds which category is showing. Render the control with `CategorySwitcher`
 * and the panels with `TabsContents`/`TabsContent`.
 */
function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [activeValue, setActiveValue] = React.useState(defaultValue || "");

  const handleValueChange = React.useCallback(
    (val: string) => {
      if (value === undefined) setActiveValue(val);
      onValueChange?.(val);
    },
    [value, onValueChange]
  );

  const currentValue = value !== undefined ? value : activeValue;

  const context = React.useMemo(
    () => ({ activeValue: currentValue, handleValueChange }),
    [currentValue, handleValueChange]
  );

  return (
    <TabsContext.Provider value={context}>
      <div className={cn("flex flex-col gap-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

type TabsContentsProps = {
  children: React.ReactNode;
  className?: string;
};

function TabsContents({ children, className }: TabsContentsProps) {
  return <div className={cn("overflow-hidden", className)}>{children}</div>;
}

type TabsContentProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
};

function TabsContent({ value, children, className }: TabsContentProps) {
  const { activeValue } = useTabs();
  if (activeValue !== value) return null;

  return (
    <div role="tabpanel" className={cn("overflow-hidden", className)}>
      {children}
    </div>
  );
}

export { Tabs, TabsContents, TabsContent, useTabs };
