"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useSidebar,
} from "@repo/ui";
import {
  Desktop,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  type IconComponent,
} from "@repo/ui/icons";
import { cn } from "@repo/ui/lib/utils";
import { useAuth } from "../contexts/auth-context";
import { useIsAdmin } from "./guards/role-guard";
import { useTheme } from "./theme-provider";
import {
  NAVIGATION_COMMANDS,
  type NavigationCommand,
} from "../lib/navigation-commands";

const RECENT_STORAGE_KEY = "ralli-wolf:command-palette:recent";
const RECENT_LIMIT = 5;

interface PaletteCommand {
  id: string;
  label: string;
  group: string;
  section?: string;
  icon: IconComponent;
  keywords: string[];
  hint?: string;
  perform: () => void;
}

interface ResultSection {
  title: string;
  commands: PaletteCommand[];
  /** Index of this section's first command in the flattened list. */
  start: number;
}

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]) {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage is unavailable (private mode, blocked cookies) — recents are
    // a convenience, so carry on without them.
  }
}

function startsAtWordBoundary(text: string, token: string) {
  return text.split(/[^a-z0-9]+/).some(word => word.startsWith(token));
}

function isSubsequence(token: string, text: string) {
  let cursor = 0;
  for (const character of text) {
    if (character === token[cursor]) cursor += 1;
    if (cursor === token.length) return true;
  }
  return false;
}

function scoreToken(
  token: string,
  label: string,
  context: string,
  keywords: string[]
) {
  if (label === token) return 120;
  if (label.startsWith(token)) return 100;
  if (startsAtWordBoundary(label, token)) return 80;
  if (label.includes(token)) return 60;
  if (keywords.some(keyword => keyword.startsWith(token))) return 45;
  if (keywords.some(keyword => keyword.includes(token))) return 35;
  if (context.includes(token)) return 25;
  if (isSubsequence(token, label)) return 10;
  return 0;
}

/** Sum of per-token scores; 0 when any token fails to match at all. */
function scoreCommand(command: PaletteCommand, tokens: string[]) {
  const label = command.label.toLowerCase();
  const context = `${command.section ?? ""} ${command.group}`.toLowerCase();
  const keywords = command.keywords.map(keyword => keyword.toLowerCase());

  let total = 0;
  for (const token of tokens) {
    const score = scoreToken(token, label, context, keywords);
    if (score === 0) return 0;
    total += score;
  }
  return total;
}

function useShortcutLabel() {
  const [label, setLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setLabel(isMac ? "⌘K" : "Ctrl K");
  }, []);

  return label;
}

function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { open: sidebarOpen, toggle: toggleSidebar } = useSidebar();

  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [recent, setRecent] = React.useState<string[]>([]);
  const itemRefs = React.useRef(new Map<number, HTMLDivElement>());

  React.useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  const go = React.useCallback(
    (destination: NavigationCommand) => {
      if (destination.external) {
        window.open(destination.href, "_blank", "noopener,noreferrer");
        return;
      }
      router.push(destination.href);
      onNavigate?.();
    },
    [router, onNavigate]
  );

  const commands = React.useMemo<PaletteCommand[]>(() => {
    const destinations = NAVIGATION_COMMANDS.filter(
      destination => !destination.adminOnly || isAdmin
    ).map<PaletteCommand>(destination => ({
      id: destination.id,
      label: destination.label,
      group: destination.group,
      section: destination.section,
      icon: destination.icon,
      keywords: destination.keywords ?? [],
      hint: destination.external ? "Opens in a new tab" : undefined,
      perform: () => go(destination),
    }));

    const actions: PaletteCommand[] = [
      {
        id: "action:theme-light",
        label: "Switch to light theme",
        group: "Actions",
        section: "Appearance",
        icon: Sun,
        keywords: ["theme", "appearance", "day", "bright"],
        hint: theme === "light" ? "Current" : undefined,
        perform: () => setTheme("light"),
      },
      {
        id: "action:theme-dark",
        label: "Switch to dark theme",
        group: "Actions",
        section: "Appearance",
        icon: Moon,
        keywords: ["theme", "appearance", "night"],
        hint: theme === "dark" ? "Current" : undefined,
        perform: () => setTheme("dark"),
      },
      {
        id: "action:theme-system",
        label: "Use system theme",
        group: "Actions",
        section: "Appearance",
        icon: Desktop,
        keywords: ["theme", "appearance", "auto", "os"],
        hint: theme === "system" ? "Current" : undefined,
        perform: () => setTheme("system"),
      },
      {
        id: "action:toggle-sidebar",
        label: sidebarOpen ? "Collapse navigation" : "Expand navigation",
        group: "Actions",
        section: "Workspace",
        icon: Menu,
        keywords: ["sidebar", "menu", "minimise", "minimize", "width"],
        perform: toggleSidebar,
      },
      {
        id: "action:logout",
        label: "Log out",
        group: "Actions",
        section: "Session",
        icon: LogOut,
        keywords: ["sign out", "exit", "logout"],
        perform: () => {
          void logout();
        },
      },
    ];

    return [...destinations, ...actions];
  }, [isAdmin, go, theme, setTheme, sidebarOpen, toggleSidebar, logout]);

  const sections = React.useMemo<ResultSection[]>(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    const grouped: Array<{ title: string; commands: PaletteCommand[] }> = [];

    if (tokens.length === 0) {
      const recentCommands = recent
        .map(id => commands.find(command => command.id === id))
        .filter((command): command is PaletteCommand => Boolean(command))
        .slice(0, RECENT_LIMIT);

      if (recentCommands.length > 0) {
        grouped.push({ title: "Recent", commands: recentCommands });
      }

      for (const command of commands) {
        const existing = grouped.find(
          entry => entry.title === command.group && entry.title !== "Recent"
        );
        if (existing) existing.commands.push(command);
        else grouped.push({ title: command.group, commands: [command] });
      }
    } else {
      const ranked = commands
        .map((command, index) => ({
          command,
          index,
          score: scoreCommand(command, tokens),
        }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(entry => entry.command);

      if (ranked.length > 0)
        grouped.push({ title: "Results", commands: ranked });
    }

    let start = 0;
    return grouped.map(entry => {
      const section = { ...entry, start };
      start += entry.commands.length;
      return section;
    });
  }, [commands, query, recent]);

  const flatCommands = React.useMemo(
    () => sections.flatMap(section => section.commands),
    [sections]
  );

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  React.useEffect(() => {
    if (activeIndex > flatCommands.length - 1) setActiveIndex(0);
  }, [activeIndex, flatCommands.length]);

  React.useEffect(() => {
    itemRefs.current.get(activeIndex)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, sections]);

  const runCommand = React.useCallback(
    (command: PaletteCommand) => {
      const nextRecent = [
        command.id,
        ...readRecent().filter(id => id !== command.id),
      ].slice(0, RECENT_LIMIT);
      writeRecent(nextRecent);
      setRecent(nextRecent);
      onOpenChange(false);
      command.perform();
    },
    [onOpenChange]
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatCommands.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(current => (current + 1) % flatCommands.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        current => (current - 1 + flatCommands.length) % flatCommands.length
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(flatCommands.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = flatCommands[activeIndex];
      if (command) runCommand(command);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-label="Command palette"
        className="bottom-auto top-[12vh] max-w-xl"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages and actions, then press Enter to run the highlighted
          result.
        </DialogDescription>

        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search size={16} className="shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages and actions…"
            className="h-6 w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            role="combobox"
            aria-expanded
            aria-controls="command-palette-list"
            aria-autocomplete="list"
            aria-activedescendant={
              flatCommands.length > 0
                ? `command-palette-option-${activeIndex}`
                : undefined
            }
          />
        </div>

        <div
          id="command-palette-list"
          role="listbox"
          aria-label="Commands"
          className="max-h-[22rem] overflow-y-auto overscroll-contain p-1.5"
        >
          {flatCommands.length === 0 ? (
            <p className="px-2.5 py-8 text-center text-sm text-muted-foreground">
              No matches for “{query.trim()}”
            </p>
          ) : (
            sections.map(section => (
              <div key={section.title} className="pb-1 last:pb-0">
                <p className="px-2.5 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {section.title}
                </p>
                {section.commands.map((command, indexInSection) => {
                  const index = section.start + indexInSection;
                  const active = index === activeIndex;
                  const Icon = command.icon;

                  return (
                    <div
                      key={`${section.title}:${command.id}`}
                      id={`command-palette-option-${index}`}
                      ref={element => {
                        if (element) itemRefs.current.set(index, element);
                        else itemRefs.current.delete(index);
                      }}
                      role="option"
                      aria-selected={active}
                      tabIndex={-1}
                      onMouseMove={() => setActiveIndex(index)}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => runCommand(command)}
                      className={cn(
                        "flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[0.8125rem] text-foreground",
                        active && "bg-secondary"
                      )}
                    >
                      <Icon
                        size={16}
                        className="shrink-0 text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {command.label}
                      </span>
                      {(command.hint ?? command.section) && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {command.hint ?? command.section}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[0.6875rem] text-muted-foreground">
          <span>
            <kbd className="font-sans">↑</kbd>{" "}
            <kbd className="font-sans">↓</kbd> to navigate
          </span>
          <span>
            <kbd className="font-sans">↵</kbd> to select
          </span>
          <span>
            <kbd className="font-sans">esc</kbd> to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
  const { open: sidebarOpen } = useSidebar();
  const shortcut = useShortcutLabel();

  const shared =
    "inline-flex h-9 items-center rounded-md border border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/25";

  if (!sidebarOpen) {
    return (
      <div className="border-b border-sidebar-border px-2 py-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onOpen}
                aria-label="Open command palette"
                aria-keyshortcuts="Meta+K Control+K"
                className={cn(shared, "w-full justify-center px-0")}
              >
                <Search size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Search pages and actions
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="border-b border-sidebar-border px-3 py-3">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open command palette"
        aria-keyshortcuts="Meta+K Control+K"
        className={cn(shared, "w-full gap-2 px-2.5 text-[0.8125rem]")}
      >
        <Search size={16} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">
          Search or jump to…
        </span>
        {shortcut && (
          <kbd className="shrink-0 rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 font-sans text-[0.625rem] font-medium text-sidebar-foreground/60">
            {shortcut}
          </kbd>
        )}
      </button>
    </div>
  );
}

/**
 * Sidebar search field plus the palette dialog it opens. Also owns the global
 * ⌘K / Ctrl+K shortcut, so it must be mounted exactly once per layout.
 */
export function SidebarCommandPalette({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(current => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <CommandPaletteTrigger onOpen={() => setOpen(true)} />
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        onNavigate={onNavigate}
      />
    </>
  );
}
