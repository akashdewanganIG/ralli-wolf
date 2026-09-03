"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { usePricebooks } from "@/hooks/use-pricebooks";
import { DataTable } from "@/components/data-table";
import type { TableColumn } from "@/components/data-table";
import type { PriceBook } from "@/lib/api/types";
import { Badge } from "@repo/ui/components/ui/badge";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Alert } from "@repo/ui/components/ui/alert";
import { PageHeader } from "@repo/ui/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { SearchFilterToolbar } from "@repo/ui/components/ui/toolbar";
import { Search } from "@repo/ui/icons";
import { TablePageSkeleton } from "@/components/skeletons";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { DataTransfer } from "@/components/data-transfer/data-transfer";
import { AddPricebookModal } from "@/components/add-pricebook-modal";

type SortField =
  | "id"
  | "name"
  | "currencyISOCode"
  | "isActive"
  | "description"
  | "createdAt";
type SortDirection = "asc" | "desc";
type SortValue = `${SortField}:${SortDirection}`;

const sortFields: ReadonlyArray<{ value: SortField; label: string }> = [
  { value: "id", label: "ID" },
  { value: "name", label: "Name" },
  { value: "currencyISOCode", label: "Currency" },
  { value: "isActive", label: "Status" },
  { value: "description", label: "Description" },
  { value: "createdAt", label: "Created at" },
];

function comparePriceBooks(
  a: PriceBook,
  b: PriceBook,
  field: SortField,
  direction: SortDirection
) {
  let comparison = 0;

  if (field === "id") {
    comparison = a.id - b.id;
  } else if (field === "createdAt") {
    comparison =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  } else if (field === "isActive") {
    comparison = Number(a.isActive) - Number(b.isActive);
  } else {
    comparison = String(a[field] ?? "").localeCompare(
      String(b[field] ?? ""),
      undefined,
      { numeric: true, sensitivity: "base" }
    );
  }

  return direction === "asc" ? comparison : -comparison;
}

const columns: TableColumn<PriceBook>[] = [
  {
    key: "id",
    label: "ID",
    render: id => id,
  },
  {
    key: "name",
    label: "Name",
    render: name => name,
  },
  {
    key: "currencyISOCode",
    label: "Currency",
    render: currencyISOCode => (
      <Badge variant="outline">{currencyISOCode}</Badge>
    ),
  },
  {
    key: "isActive",
    label: "Status",
    render: isActive => (
      <Badge variant={isActive ? "default" : "destructive"}>
        {isActive ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    key: "description",
    label: "Description",
    render: description => description || "-",
  },
  {
    key: "createdAt",
    label: "Created At",
    render: createdAt => new Date(createdAt).toLocaleString(),
  },
];

export default function PriceBookEntriesPage() {
  const { data, isLoading, error } = usePricebooks();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortValue, setSortValue] = useState<SortValue>("id:asc");
  const [showAddModal, setShowAddModal] = useState(false);
  const router = useRouter();

  const filteredAndSortedData = useMemo(() => {
    if (!data?.data) return [];

    let filtered = data.data;

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query)
      );
    }

    const [field, direction] = sortValue.split(":") as [
      SortField,
      SortDirection,
    ];
    filtered = [...filtered].sort((a, b) =>
      comparePriceBooks(a, b, field, direction)
    );

    return filtered;
  }, [data?.data, searchQuery, sortValue]);

  if (isLoading) return <TablePageSkeleton filters={1} />;
  if (error)
    return (
      <PageShell>
        <Alert tone="error" title="Price books could not be loaded">
          Refresh the page to try again. If the issue continues, contact an
          administrator.
        </Alert>
      </PageShell>
    );

  return (
    <PageShell>
      <PageHeader
        title="Price books"
        description="Your price lists. These decide what a customer is charged on a quote or order."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3 whitespace-nowrap"
            >
              New price book
            </Button>
            <DataTransfer entity="price-books" />
          </div>
        }
      />

      <SearchFilterToolbar
        search={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 inset-y-0 my-auto h-fit size-4 text-muted-foreground" />
            <Input
              aria-label="Search price books"
              placeholder="Search by name…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        }
        actions={
          <Select
            value={sortValue}
            onValueChange={value => setSortValue(value as SortValue)}
          >
            <SelectTrigger
              aria-label="Sort price books"
              className="w-full sm:w-60"
            >
              <SelectValue placeholder="Sort price books" />
            </SelectTrigger>
            <SelectContent>
              {sortFields.map(field => (
                <SelectGroup key={field.value}>
                  <SelectLabel>{field.label}</SelectLabel>
                  <SelectItem value={`${field.value}:asc`}>
                    {field.label} · Ascending
                  </SelectItem>
                  <SelectItem value={`${field.value}:desc`}>
                    {field.label} · Descending
                  </SelectItem>
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <DataTable
        data={filteredAndSortedData}
        columns={columns}
        count={filteredAndSortedData.length}
        getRowHref={item => `/sales/price-books/${item.id}`}
      />

      <AddPricebookModal open={showAddModal} onOpenChange={setShowAddModal} />
    </PageShell>
  );
}
