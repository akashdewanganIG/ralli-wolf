"use client";

import { usePricebookEntries } from "@/hooks/usePricebookEntries";
import { useProduct } from "@/hooks/useProducts";
import { PriceBookEntry } from "@/lib/api/types";
import { DetailCard, DetailPageHeader } from "@repo/ui";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  FileText,
  Hash,
  LayoutGrid,
  Package,
  Plus,
  Tag,
} from "@repo/ui/icons";
import React from "react";
import { AddPricebookEntryModal } from "./AddPricebookEntryModal";
import { EditPricebookEntryModal } from "./EditPricebookEntryModal";
import { DataTable, TableColumn } from "./data-table";
import {
  ActivityFeedSkeleton,
  DetailHeaderSkeleton,
  DetailSidebarSkeleton,
  SectionSkeleton,
  TableSkeleton,
} from "./skeletons";

import { PageShell } from "@repo/ui/components/ui/page-shell";
import { formatMoney } from "@/lib/utils/decimal";

interface ProductDetailPageProps {
  productId: number;
  onBack?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ProductDetailPage({
  productId,
  onBack,
}: ProductDetailPageProps) {
  const {
    data: product,
    isLoading: productLoading,
    error: productError,
  } = useProduct(productId);

  const { data: pricebookEntriesData, isLoading: pricebookEntriesLoading } =
    usePricebookEntries({ productId });

  const [showAddPriceBookEntryModal, setShowAddPriceBookEntryModal] =
    React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<PriceBookEntry | null>(
    null
  );

  if (productLoading) return <HandleProductLoading />;
  if (productError || !product)
    return <HandleProductLoadError onBack={onBack} />;

  const handleAddPriceBookEntry = () => {
    setShowAddPriceBookEntryModal(true);
  };

  const handleEditPriceBookEntry = (entry: PriceBookEntry) => {
    setEditingEntry(entry);
  };

  const productDetails = product.data;

  const displayName = productDetails?.name ?? "";

  const pricebookEntryColumns: TableColumn<PriceBookEntry>[] = [
    {
      key: "priceBook.name",
      label: "Name",
      render: (_, item) => item.priceBook?.name,
    },
    {
      key: "listPrice",
      label: "List Price",
      render: value => formatMoney(value as string | number),
    },
    {
      key: "isActive",
      label: "Is Active",
      render: value => (
        <Badge variant={value ? "default" : "secondary"}>
          {value ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "useStandardPrice",
      label: "Use Standard Price",
      render: value => (
        <Badge variant={value ? "default" : "secondary"}>
          {value ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      label: "Created At",
      render: value => new Date(value).toLocaleString(),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, item) => (
        <Button variant="ghost" onClick={() => handleEditPriceBookEntry(item)}>
          <Edit className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const pbeData = pricebookEntriesData?.data ?? [];

  return (
    <div className="p-4">
      <DetailPageHeader title={displayName} onBack={onBack} />

      <div className="space-y-4 mt-4">
        <DetailCard
          title="Product Details"
          className="bg-surface border-border"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info-surface">
                <Tag className="h-3.5 w-3.5 text-info" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Product Name
                </p>
                <p className="text-sm font-medium text-text-secondary">
                  {productDetails.name}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Product Code
                </p>
                <p className="text-sm font-medium text-text-secondary">
                  {productDetails.code}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${productDetails.active ? "bg-success-surface" : "bg-error-surface"}`}
              >
                <CheckCircle2
                  className={`h-3.5 w-3.5 ${productDetails.active ? "text-success" : "text-destructive"}`}
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Status
                </p>
                <p
                  className={`text-sm font-medium ${productDetails.active ? "text-success-foreground" : "text-destructive"}`}
                >
                  {productDetails.active ? "Active" : "Inactive"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warning-surface">
                <Package className="h-3.5 w-3.5 text-warning" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Product Type
                </p>
                <p className="text-sm font-medium text-text-secondary">
                  {productDetails.component ? "Component" : "Finished Product"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Category
                </p>
                <p className="text-sm font-medium text-text-secondary">
                  {productDetails.category?.name ?? "—"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info-surface">
                <Calendar className="h-3.5 w-3.5 text-info" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Created At
                </p>
                <p className="text-sm font-medium text-text-secondary">
                  {new Date(productDetails.createdAt).toLocaleDateString(
                    "en-GB"
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Last Updated
                </p>
                <p className="text-sm font-medium text-text-secondary">
                  {new Date(productDetails.updatedAt).toLocaleDateString(
                    "en-GB"
                  )}
                </p>
              </div>
            </div>
          </div>
          {productDetails.description && (
            <div className="mt-4 pt-4 border-t border-subtle flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Description
                </p>
                <p className="text-sm font-medium text-text-secondary">
                  {productDetails.description}
                </p>
              </div>
            </div>
          )}
        </DetailCard>

        <div className="bg-surface p-4 rounded-lg shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Price Book Entries</h2>
            <Button
              variant="outline"
              onClick={handleAddPriceBookEntry}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Add Price Book Entry
            </Button>
          </div>
          {pricebookEntriesLoading ? (
            <p>Loading price book entries...</p>
          ) : (
            <DataTable
              data={pbeData}
              columns={pricebookEntryColumns}
              title="Price Book Entries"
              count={pbeData.length}
              getRowHref={item => `/sales/price-books/${item.priceBookId}`}
            />
          )}
        </div>
      </div>
      <AddPricebookEntryModal
        open={showAddPriceBookEntryModal}
        onOpenChange={setShowAddPriceBookEntryModal}
        productId={productId}
        pricebookEntries={pbeData}
      />
      <EditPricebookEntryModal
        open={!!editingEntry}
        onOpenChange={open => {
          if (!open) {
            setEditingEntry(null);
          }
        }}
        entry={editingEntry}
      />
    </div>
  );
}

function HandleProductLoadError({
  onBack,
}: {
  onBack: (() => void) | undefined;
}) {
  return (
    <div className="min-h-[60vh] p-4 flex items-center justify-center">
      <div className="text-center">
        <p className="text-destructive mb-4">Failed to load Product details</p>
        {onBack && (
          <Button onClick={onBack} variant="outline">
            Go Back
          </Button>
        )}
      </div>
    </div>
  );
}

function HandleProductLoading() {
  return (
    <PageShell>
      <DetailHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <SectionSkeleton>
            <TableSkeleton rows={4} />
          </SectionSkeleton>
          <SectionSkeleton>
            <TableSkeleton rows={3} />
          </SectionSkeleton>
          <ActivityFeedSkeleton items={4} />
        </div>
        <div className="space-y-4">
          <DetailSidebarSkeleton />
          <DetailSidebarSkeleton items={3} />
        </div>
      </div>
    </PageShell>
  );
}
