"use client";

import * as React from "react";
import { Check, ShieldAlert } from "@repo/ui/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import {
  PERMISSION_GROUPS,
  PERMISSIONS,
  type Permission,
} from "@repo/db/permissions";

export function PermissionsDialog({
  open,
  onOpenChange,
  value,
  onSave,
  subjectName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: Permission[];
  onSave: (permissions: Permission[]) => void;
  subjectName?: string;
}) {
  const [draft, setDraft] = React.useState<Permission[]>(value);

  React.useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const selected = React.useMemo(() => new Set(draft), [draft]);

  const toggle = (permission: Permission) => {
    setDraft(current =>
      current.includes(permission)
        ? current.filter(item => item !== permission)
        : [...current, permission]
    );
  };

  const toggleGroup = (permissions: Permission[], allOn: boolean) => {
    setDraft(current => {
      const next = new Set(current);
      for (const permission of permissions) {
        if (allOn) next.delete(permission);
        else next.add(permission);
      }
      return [...next];
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Custom permissions</DialogTitle>
          <DialogDescription>
            {subjectName
              ? `Choose exactly what ${subjectName} can reach.`
              : "Choose exactly what this account can reach."}{" "}
            Anything left unchecked is refused by the API, not just hidden.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="grid gap-4 lg:grid-cols-2">
            {PERMISSION_GROUPS.map(group => {
              const groupPermissions = group.permissions.map(p => p.value);
              const allOn = groupPermissions.every(p => selected.has(p));
              const someOn = groupPermissions.some(p => selected.has(p));

              return (
                <section
                  key={group.group}
                  className="rounded-xl border border-border bg-card"
                >
                  <header className="flex items-start justify-between gap-3 border-b border-border px-3.5 py-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground">
                        {group.group}
                      </h3>
                      <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                        {group.description}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 px-2 text-xs"
                      onClick={() => toggleGroup(groupPermissions, allOn)}
                    >
                      {allOn ? "Clear" : someOn ? "Select all" : "Select all"}
                    </Button>
                  </header>
                  <ul className="divide-y divide-border/70">
                    {group.permissions.map(permission => {
                      const checked = selected.has(permission.value);
                      return (
                        <li key={permission.value}>
                          <label className="flex cursor-pointer items-start gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface-subtle">
                            <Checkbox
                              className="mt-0.5"
                              checked={checked}
                              onCheckedChange={() => toggle(permission.value)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm text-foreground">
                                {permission.label}
                              </span>
                              {permission.hint ? (
                                <span className="mt-0.5 flex items-center gap-1 text-xs leading-4 text-muted-foreground">
                                  <ShieldAlert className="size-3 shrink-0" />
                                  {permission.hint}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </DialogBody>

        <DialogFooter className="items-center justify-between border-t border-border px-5 py-3.5 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">
              {draft.length}
            </span>{" "}
            of {PERMISSIONS.length} selected
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={draft.length === 0}
              onClick={() => {
                onSave(draft);
                onOpenChange(false);
              }}
            >
              <Check className="size-4" />
              Apply permissions
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
