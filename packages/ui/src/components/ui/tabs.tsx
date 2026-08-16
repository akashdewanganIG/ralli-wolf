"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

const TabsContext = React.createContext<{
  activeValue: string;
  handleValueChange: (value: string) => void;
}>({
  activeValue: "",
  handleValueChange: () => {},
});

function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("useTabs must be used within a TabsProvider");
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

function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [activeValue, setActiveValue] = React.useState(defaultValue || "");

  const handleValueChange = (val: string) => {
    if (value === undefined) {
      setActiveValue(val);
    }
    onValueChange?.(val);
  };

  const currentValue = value !== undefined ? value : activeValue;

  return (
    <TabsContext.Provider
      value={{
        activeValue: currentValue,
        handleValueChange,
      }}
    >
      <div className={cn("flex flex-col gap-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

type TabsListProps = {
  children: React.ReactNode;
  className?: string;
};

function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex min-h-10 w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-secondary p-1",
        className
      )}
    >
      {children}
    </div>
  );
}

type TabsTriggerProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
};

function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { activeValue, handleValueChange } = useTabs();
  const isActive = activeValue === value;

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => handleValueChange(value)}
      data-state={isActive ? "active" : "inactive"}
      className={cn(
        "inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-surface text-foreground shadow-xs"
          : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
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
  const isActive = activeValue === value;

  if (!isActive) return null;

  return (
    <div role="tabpanel" className={cn("overflow-hidden", className)}>
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContents, TabsContent, useTabs };
