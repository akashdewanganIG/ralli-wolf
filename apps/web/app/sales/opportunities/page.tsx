"use client";

import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useQueryStates, parseAsInteger } from "nuqs";
import { Plus, RefreshCw } from "@repo/ui/icons";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { DataTable, type TableColumn } from "@/components/data-table";
import { CreateOpportunityDialog } from "@/components/opportunities/create-opportunity-dialog";
import { useOpportunitiesWithPagination } from "@/hooks/useOpportunities";
import type { OpportunityListItem } from "@/lib/api/types";
import { TablePageSkeleton } from "@/components/skeletons";
import { Alert } from "@repo/ui/components/ui/alert";
import { PageHeader } from "@repo/ui/components/ui/page-header";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { buttonVariants } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

function OpportunitiesContent() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [{ page, limit }, setQuery] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      limit: parseAsInteger.withDefault(10),
    },
    { history: "push" }
  );

  const { data, pagination, isLoading, isError, refetch } =
    useOpportunitiesWithPagination({ page, limit });

  const columns = React.useMemo<TableColumn<OpportunityListItem>[]>(
    () => [
      {
        key: "name",
        label: "Opportunity Name",
        render: (value, item) => (
          <Link
            href={`/sales/opportunities/${item.id}`}
            className="text-muted-foreground hover:text-info"
          >
            {String(value)}
          </Link>
        ),
      },
      {
        key: "accountName",
        label: "Account Name",
        render: value => (
          <span className="text-muted-foreground">{value || "-"}</span>
        ),
      },
      {
        key: "stage",
        label: "Stage",
        render: value => (
          <span className="text-muted-foreground">{value || "-"}</span>
        ),
      },
      {
        key: "closeDate",
        label: "Close Date",
        render: value => (
          <span className="text-muted-foreground">
            {value
              ? new Date(value as string).toLocaleDateString("en-GB")
              : "-"}
          </span>
        ),
      },
    ],
    []
  );

  if (isLoading) {
    return <TablePageSkeleton filters={0} />;
  }

  if (isError) {
    return (
      <PageShell>
        <Alert
          tone="error"
          title="Opportunities could not be loaded"
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
            >
              <RefreshCw className="size-4" /> Retry
            </Button>
          }
        >
          Check your connection and try again.
        </Alert>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Opportunities"
        description="Deals you are working on, from first interest through to winning or losing them."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            data-slot="button"
            className={cn(
              buttonVariants({ variant: "default" }),
              "w-full sm:w-auto"
            )}
          >
            <Plus className="size-4" />
            Create Opportunity
          </button>
        }
      />

      <DataTable<OpportunityListItem>
        data={data}
        columns={columns}
        title="Opportunity Table"
        count={pagination?.totalItems ?? data.length}
        currentPage={page}
        totalPages={pagination?.totalPages ?? 1}
        itemsPerPage={limit}
        onPageChange={p => setQuery({ page: p })}
        onItemsPerPageChange={l => setQuery({ limit: l, page: 1 })}
      />

      <CreateOpportunityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={opportunity => {
          router.push(`/sales/opportunities/${opportunity.id}`);
        }}
      />
    </PageShell>
  );
}

export default function OpportunitiesPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN", "ADMIN", "SALES"]}>
      <NuqsAdapter>
        <OpportunitiesContent />
      </NuqsAdapter>
    </RoleGuard>
  );
}
