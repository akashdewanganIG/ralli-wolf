"use client";

import * as React from "react";

const SidebarContext = React.createContext<{
  open: boolean;
  toggle: () => void;
  /** Id of the single expanded navigation group, or null when all are closed. */
  openGroup: string | null;
  toggleGroup: (id: string) => void;
  /**
   * Opens a group without closing anything the user opened themselves.
   * Used on navigation, so landing on a route reveals its section.
   */
  revealGroup: (id: string) => void;
}>({
  open: true,
  toggle: () => {},
  openGroup: null,
  toggleGroup: () => {},
  revealGroup: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true);
  /**
   * One id, not a set.
   *
   * The navigation is long enough that several expanded groups push the active
   * item below the fold. Holding a single id makes that impossible by
   * construction — opening one section is what closes the last one, so there is
   * no state in which two are open to reconcile.
   */
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);

  const toggle = React.useCallback(() => setOpen(current => !current), []);

  const toggleGroup = React.useCallback((id: string) => {
    setOpenGroup(current => (current === id ? null : id));
  }, []);

  const revealGroup = React.useCallback((id: string) => {
    setOpenGroup(current => (current === id ? current : id));
  }, []);

  // Collapsing the rail to icons hides the sub-items, so the expanded group is
  // dropped too — otherwise re-opening the rail restores a section the user
  // last saw several routes ago.
  React.useEffect(() => {
    if (!open) setOpenGroup(null);
  }, [open]);

  const value = React.useMemo(
    () => ({ open, toggle, openGroup, toggleGroup, revealGroup }),
    [open, toggle, openGroup, toggleGroup, revealGroup]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  return React.useContext(SidebarContext);
}
