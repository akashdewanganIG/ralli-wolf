"use client";

import * as React from "react";

const SidebarContext = React.createContext<{
  open: boolean;
  toggle: () => void;
}>({
  open: true,
  toggle: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true);
  const toggle = () => setOpen(o => !o);
  return (
    <SidebarContext.Provider value={{ open, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return React.useContext(SidebarContext);
}
