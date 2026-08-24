"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useQueryStates, parseAsString } from "nuqs";
import { RoleGuard } from "@/components/guards/RoleGuard";
import {
  Tabs,
  TabsContent,
  TabsContents,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { CategorySwitcher } from "@repo/ui/components/ui/category-switcher";
import { PageHeader } from "@repo/ui/components/ui/page-header";
import { ApprovalsTable } from "@/components/approvals/approvals-table";
import { useAllApprovals, useMyApprovals } from "@/hooks/useApprovals";
import { TableSkeleton } from "@/components/skeletons";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { DEFAULT_PAGE_SIZE } from "@/components/data-table";

const STATUS_OPTIONS = [
  { value: "__all__", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const TARGET_OPTIONS = [
  { value: "__all__", label: "All types" },
  { value: "QUOTE", label: "Quote" },
  { value: "OPP", label: "Opportunity" },
];

const MY_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending_for_me", label: "Pending for me" },
  { value: "raised_by_me", label: "Raised by me" },
];

function ApprovalsPageContent() {
  const router = useRouter();
  const [queryState, setQuery] = useQueryStates(
    {
      tab: parseAsString.withDefault("all"),
      status: parseAsString.withDefault(""),
      targetObjectName: parseAsString.withDefault(""),
      type: parseAsString.withDefault("all"),
    },
    { history: "push", shallow: false }
  );
  const tab = queryState.tab === "my" ? "my" : "all";
  const status = queryState.status || "";
  const targetObjectName = queryState.targetObjectName || "";
  const type = queryState.type || "all";

  const [page, setPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => {
    setPage(1);
  }, [tab, status, targetObjectName, type]);

  const allParams = React.useMemo(
    () => ({
      status: status || undefined,
      targetObjectName: targetObjectName || undefined,
      page,
      limit: itemsPerPage,
    }),
    [status, targetObjectName, page, itemsPerPage]
  );
  const myParams = React.useMemo(
    () => ({
      type: type === "all" ? undefined : type,
      status: status || undefined,
      targetObjectName: targetObjectName || undefined,
      page,
      limit: itemsPerPage,
    }),
    [type, status, targetObjectName, page, itemsPerPage]
  );

  const {
    data: allData,
    pagination: allPagination,
    isLoading: allLoading,
  } = useAllApprovals(tab === "all" ? allParams : undefined);
  const {
    data: myData,
    pagination: myPagination,
    isLoading: myLoading,
  } = useMyApprovals(tab === "my" ? myParams : undefined);

  const handleQuoteNoClick = React.useCallback(
    (approval: { id: string }) => {
      router.push(`/sales/approvals/${approval.id}`);
    },
    [router]
  );

  const setTab = React.useCallback(
    (v: string) => {
      setQuery({ tab: v === "my" ? "my" : "all" });
    },
    [setQuery]
  );

  const filterContent = (
    <div className="flex min-w-0 flex-wrap items-center gap-2 md:flex-nowrap">
      {tab === "my" && (
        <Select
          value={type}
          onValueChange={v => setQuery({ type: v || "all" })}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {MY_TYPE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select
        value={status || "__all__"}
        onValueChange={v => setQuery({ status: v === "__all__" ? "" : v })}
      >
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={targetObjectName || "__all__"}
        onValueChange={v =>
          setQuery({ targetObjectName: v === "__all__" ? "" : v })
        }
      >
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder="Target" />
        </SelectTrigger>
        <SelectContent>
          {TARGET_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const allPaginationProps = {
    count: allPagination?.totalItems ?? 0,
    currentPage: page,
    totalPages: allPagination?.totalPages ?? 1,
    itemsPerPage,
    onPageChange: setPage,
    onItemsPerPageChange: setItemsPerPage,
  };
  const myPaginationProps = {
    count: myPagination?.totalItems ?? 0,
    currentPage: page,
    totalPages: myPagination?.totalPages ?? 1,
    itemsPerPage,
    onPageChange: setPage,
    onItemsPerPageChange: setItemsPerPage,
  };

  return (
    <PageShell>
      <PageHeader
        title="Approvals"
        description="Requests waiting on a decision, and what has already been approved or rejected."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <CategorySwitcher
          label="Approval category"
          items={[
            { value: "all", label: "All approvals" },
            { value: "my", label: "My approvals" },
          ]}
        />

        <TabsContents>
          <TabsContent value="all">
            {allLoading ? (
              <div className="rounded-xl border bg-card p-4">
                <TableSkeleton rows={7} />
              </div>
            ) : (
              <ApprovalsTable
                approvals={allData ?? []}
                title="All Approvals"
                onQuoteNoClick={handleQuoteNoClick}
                columnPreferenceKey="approvals-all"
                headerLeadingContent={filterContent}
                {...allPaginationProps}
              />
            )}
          </TabsContent>
          <TabsContent value="my">
            {myLoading ? (
              <div className="rounded-xl border bg-card p-4">
                <TableSkeleton rows={7} />
              </div>
            ) : (
              <ApprovalsTable
                approvals={myData ?? []}
                title="My Approvals"
                onQuoteNoClick={handleQuoteNoClick}
                columnPreferenceKey="approvals-my"
                headerLeadingContent={filterContent}
                {...myPaginationProps}
              />
            )}
          </TabsContent>
        </TabsContents>
      </Tabs>
    </PageShell>
  );
}

export default function ApprovalsPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN", "ADMIN", "SALES"]}>
      <NuqsAdapter>
        <ApprovalsPageContent />
      </NuqsAdapter>
    </RoleGuard>
  );
}
