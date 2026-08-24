"use client";

import * as React from "react";

import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Panel } from "@repo/ui/components/ui/panel";
import { Skeleton, SkeletonRegion } from "@repo/ui/components/ui/skeleton";

import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  type NotificationPreference,
} from "@/hooks/useNotifications";

/** Groups the list without reordering within a group. */
function groupPreferences(rows: NotificationPreference[]) {
  const groups = new Map<string, NotificationPreference[]>();
  for (const row of rows) {
    const existing = groups.get(row.group);
    if (existing) existing.push(row);
    else groups.set(row.group, [row]);
  }
  return [...groups.entries()];
}

function sameAs(a: NotificationPreference[], b: NotificationPreference[]) {
  if (a.length !== b.length) return false;
  return a.every((row, index) => {
    const other = b[index];
    return (
      other &&
      row.type === other.type &&
      row.inApp === other.inApp &&
      row.email === other.email
    );
  });
}

export function NotificationPreferences() {
  const { data, isLoading, isError, refetch } = useNotificationPreferences();
  const save = useUpdateNotificationPreferences();

  const server = React.useMemo(() => data?.data ?? [], [data]);
  const [draft, setDraft] = React.useState<NotificationPreference[]>([]);

  // The server list is the source of truth; a fetch replaces the draft rather
  // than merging, so a change made in another tab is not silently overwritten.
  React.useEffect(() => setDraft(server), [server]);

  const dirty = !sameAs(draft, server);

  const setChannel = (
    type: string,
    channel: "inApp" | "email",
    value: boolean
  ) => {
    setDraft(rows =>
      rows.map(row => (row.type === type ? { ...row, [channel]: value } : row))
    );
  };

  const setAll = (channel: "inApp" | "email", value: boolean) => {
    setDraft(rows =>
      rows.map(row =>
        channel === "email" && !row.supportsEmail
          ? row
          : { ...row, [channel]: value }
      )
    );
  };

  if (isLoading) {
    return (
      <Panel title="Delivery preferences">
        <SkeletonRegion label="Loading notification preferences" className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-72" />
              </div>
              <Skeleton className="size-4 shrink-0 rounded" />
              <Skeleton className="size-4 shrink-0 rounded" />
            </div>
          ))}
        </SkeletonRegion>
      </Panel>
    );
  }

  // A failed request and an empty list are different things: without this,
  // "could not load" would read as "there is nothing to configure", and the
  // user would never think to retry.
  if (isError) {
    return (
      <Panel title="Delivery preferences">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your notification preferences could not be loaded.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
          >
            Try again
          </Button>
        </div>
      </Panel>
    );
  }

  if (!draft.length) {
    return (
      <Panel title="Delivery preferences">
        <p className="text-sm text-muted-foreground">
          There are no configurable notifications yet.
        </p>
      </Panel>
    );
  }

  const allOn = (channel: "inApp" | "email") =>
    draft.every(row => (channel === "email" && !row.supportsEmail) || row[channel]);

  return (
    <Panel
      title="Delivery preferences"
      description="Choose which alerts you see in the app, and which also arrive by email. Turning one off stops both."
      action={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!dirty || save.isPending}
              onClick={() => setDraft(server)}
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate(draft)}
            >
              {save.isPending ? "Saving…" : "Save preferences"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="px-0 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Notification
              </th>
              {(["inApp", "email"] as const).map(channel => (
                <th
                  key={channel}
                  scope="col"
                  className="w-24 px-2 py-2 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                >
                  <span className="block">
                    {channel === "inApp" ? "In-app" : "Email"}
                  </span>
                  {/*
                    A column-level toggle: with five rows and two channels,
                    "turn all email off" is the most likely intent and would
                    otherwise take five clicks.
                  */}
                  <button
                    type="button"
                    onClick={() => setAll(channel, !allOn(channel))}
                    className="mt-0.5 text-[0.6875rem] font-medium normal-case tracking-normal text-primary outline-none hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    {allOn(channel) ? "None" : "All"}
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          {groupPreferences(draft).map(([group, rows]) => (
            <tbody key={group}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={3}
                  className="px-0 pb-1 pt-4 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                >
                  {group}
                </th>
              </tr>
              {rows.map(row => (
                <tr key={row.type} className="border-b border-border-subtle">
                  <td className="min-w-0 py-2.5 pr-4">
                    <p className="font-medium text-foreground">{row.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.description}
                    </p>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <Checkbox
                      checked={row.inApp}
                      onCheckedChange={value =>
                        setChannel(row.type, "inApp", value)
                      }
                      aria-label={`Show ${row.label} in the notifications menu`}
                    />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <Checkbox
                      checked={row.supportsEmail && row.email}
                      disabled={!row.supportsEmail}
                      onCheckedChange={value =>
                        setChannel(row.type, "email", value)
                      }
                      aria-label={`Email me about ${row.label}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Panel>
  );
}
