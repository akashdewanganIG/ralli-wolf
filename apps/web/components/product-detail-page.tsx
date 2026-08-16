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
} from "lucide-react";
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

import { useCurrency } from "@/contexts/CurrencyContext";

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
  const { symbol: currencySymbol } = useCurrency();

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
      render: value => `${currencySymbol} ${value}`,
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleEditPriceBookEntry(item)}
        >
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
          className="bg-white border-gray-200"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                <Tag className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Product Name
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {productDetails.name}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50">
                <Hash className="h-3.5 w-3.5 text-violet-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Product Code
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {productDetails.code}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${productDetails.active ? "bg-green-50" : "bg-red-50"}`}
              >
                <CheckCircle2
                  className={`h-3.5 w-3.5 ${productDetails.active ? "text-green-500" : "text-red-500"}`}
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Status
                </p>
                <p
                  className={`text-sm font-medium ${productDetails.active ? "text-green-600" : "text-red-600"}`}
                >
                  {productDetails.active ? "Active" : "Inactive"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-50">
                <Package className="h-3.5 w-3.5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Product Type
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {productDetails.component ? "Component" : "Finished Product"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-50">
                <LayoutGrid className="h-3.5 w-3.5 text-sky-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Category
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {productDetails.category?.name ?? "—"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Created At
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {new Date(productDetails.createdAt).toLocaleDateString(
                    "en-GB"
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-50">
                <Clock className="h-3.5 w-3.5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Last Updated
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {new Date(productDetails.updatedAt).toLocaleDateString(
                    "en-GB"
                  )}
                </p>
              </div>
            </div>
          </div>
          {productDetails.description && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100">
                <FileText className="h-3.5 w-3.5 text-gray-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Description
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {productDetails.description}
                </p>
              </div>
            </div>
          )}
        </DetailCard>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
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
        <p className="text-red-600 mb-4">Failed to load Product details</p>
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
    <div className="space-y-5 p-4">
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
    </div>
  );
}
