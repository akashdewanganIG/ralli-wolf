"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown, ChevronRight, ExternalLink } from "@repo/ui/icons";
import {
  ARCH_NODE_BY_ID,
  type ArchNode,
  type ArchRelation,
} from "@/lib/architecture-map";

/**
 * The small-screen renderer. Deliberately not a shrunken canvas — the same
 * structured data presented as a collapsible outline, which stays readable
 * and tappable at phone width.
 */
export function ArchitectureOutline({
  modules,
  nodesByParent,
  relations,
  collapsed,
  onToggleCollapse,
  focusRequest,
}: {
  modules: ArchNode[];
  nodesByParent: Map<string | null, ArchNode[]>;
  relations: ArchRelation[];
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  focusRequest: { id: string; nonce: number } | null;
}) {
  const [highlightId, setHighlightId] = React.useState<string | null>(null);
  const refs = React.useRef(new Map<string, HTMLElement | null>());

  React.useEffect(() => {
    if (!focusRequest) return;
    const element = refs.current.get(focusRequest.id);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightId(focusRequest.id);
    const timer = window.setTimeout(() => setHighlightId(null), 2200);
    return () => window.clearTimeout(timer);
  }, [focusRequest]);

  const linksFor = React.useCallback(
    (nodeId: string) =>
      relations
        .filter(relation => relation.from === nodeId)
        .map(relation => ({
          label: relation.label,
          target: ARCH_NODE_BY_ID.get(relation.to),
        }))
        .filter(entry => Boolean(entry.target)),
    [relations]
  );

  return (
    <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-border bg-surface-subtle p-2">
      {modules.map(module => {
        const moduleCollapsed = collapsed.has(module.id);
        const children = nodesByParent.get(module.id) ?? [];

        return (
          <section
            key={module.id}
            className="overflow-hidden rounded-md border border-border bg-surface"
          >
            <button
              type="button"
              onClick={() => onToggleCollapse(module.id)}
              aria-expanded={!moduleCollapsed}
              className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {moduleCollapsed ? (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-foreground">
                {module.label}
              </span>
            </button>

            {!moduleCollapsed ? (
              <div className="space-y-1 border-t border-border-subtle px-2 pb-2 pt-2">
                {children.map(child =>
                  child.kind === "section" ? (
                    <div key={child.id}>
                      <button
                        type="button"
                        onClick={() => onToggleCollapse(child.id)}
                        aria-expanded={!collapsed.has(child.id)}
                        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        {collapsed.has(child.id) ? (
                          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                          {child.label}
                        </span>
                      </button>
                      {!collapsed.has(child.id) ? (
                        <ul className="space-y-1 pl-4">
                          {(nodesByParent.get(child.id) ?? []).map(leaf => (
                            <OutlineLeaf
                              key={leaf.id}
                              node={leaf}
                              links={linksFor(leaf.id)}
                              highlighted={highlightId === leaf.id}
                              registerRef={element =>
                                refs.current.set(leaf.id, element)
                              }
                            />
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : (
                    <ul key={child.id} className="space-y-1">
                      <OutlineLeaf
                        node={child}
                        links={linksFor(child.id)}
                        highlighted={highlightId === child.id}
                        registerRef={element =>
                          refs.current.set(child.id, element)
                        }
                      />
                    </ul>
                  )
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function OutlineLeaf({
  node,
  links,
  highlighted,
  registerRef,
}: {
  node: ArchNode;
  links: Array<{ label: string; target?: ArchNode }>;
  highlighted: boolean;
  registerRef: (element: HTMLElement | null) => void;
}) {
  const shared = cn(
    "block rounded-md border px-2.5 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
    node.route
      ? "border-border bg-surface hover:border-border-strong hover:bg-hover"
      : "border-dashed border-border bg-transparent",
    highlighted && "ring-2 ring-ring ring-offset-2 ring-offset-surface"
  );

  const body = (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-foreground">
          {node.label}
        </span>
        {node.external ? (
          <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
        ) : null}
      </span>
      <span className="mt-0.5 block text-[0.6875rem] leading-4 text-muted-foreground">
        {node.description}
      </span>
      {links.length ? (
        <span className="mt-1.5 flex flex-wrap gap-1">
          {links.slice(0, 3).map(link => (
            <span
              key={`${node.id}-${link.target?.id}`}
              className="rounded bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground"
            >
              → {link.target?.label}
            </span>
          ))}
        </span>
      ) : null}
    </>
  );

  return (
    <li ref={registerRef as React.Ref<HTMLLIElement>}>
      {node.route && node.external ? (
        <a
          href={node.route}
          target="_blank"
          rel="noreferrer"
          className={shared}
        >
          {body}
        </a>
      ) : node.route ? (
        <Link href={node.route} className={shared}>
          {body}
        </Link>
      ) : (
        <div className={shared}>{body}</div>
      )}
    </li>
  );
}
