"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { usePricebook } from "@/hooks/usePricebooks";
import { usePricebookEntriesByPriceBookId } from "@/hooks/usePricebookEntries";
import { DataTable } from "@/components/data-table";
import type { TableColumn } from "@/components/data-table";
import type { PriceBookEntry } from "@/lib/api/types";
import {
  DetailPageHeader,
  DetailCard,
  InfoGrid,
  InfoField,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContents,
} from "@repo/ui";

const entryColumns: TableColumn<PriceBookEntry>[] = [
  {
    key: "id",
    label: "ID",
    render: id => id,
  },
  {
    key: "productId",
    label: "Product",
    render: (_, item) => item.product?.name || `Product #${item.productId}`,
  },
  {
    key: "listPrice",
    label: "List Price",
    render: listPrice => `₹${Number(listPrice).toLocaleString("en-IN")}`,
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
    key: "useStandardPrice",
    label: "Standard Price",
    render: useStandardPrice => (
      <Badge variant={useStandardPrice ? "default" : "secondary"}>
        {useStandardPrice ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    key: "createdAt",
    label: "Created At",
    render: createdAt =>
      new Date(createdAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
  },
];

interface PageProps {
  params: Promise<{ pricebookId: string }>;
}

export default function PriceBookDetailPage({ params }: PageProps) {
  const { pricebookId } = use(params);
  const priceBookId = parseInt(pricebookId);
  const router = useRouter();

  const {
    data: pbData,
    isLoading: pbLoading,
    error: pbError,
  } = usePricebook(priceBookId);
  const { data: entriesData, isLoading: entriesLoading } =
    usePricebookEntriesByPriceBookId({ priceBookId });

  if (pbLoading) {
    return (
      <div className="min-h-[60vh] p-4 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">
          Loading price book...
        </div>
      </div>
    );
  }

  // The API wraps the single record: { data: PriceBook } — the TS type is incorrect
  const pb = (pbData as any)?.data ?? pbData;

  if (pbError || !pb) {
    return (
      <div className="space-y-5 p-4">
        <div className="text-lg font-semibold">Price book not found</div>
        <button
          type="button"
          className="text-sm underline text-muted-foreground"
          onClick={() => router.push("/sales/price-books")}
        >
          Back to Price Books
        </button>
      </div>
    );
  }
  const entries = entriesData?.data ?? [];

  return (
    <div className="space-y-5 p-4">
      <DetailPageHeader
        title={pb.name}
        status={pb.isActive ? "Active" : "Inactive"}
        statusVariant={pb.isActive ? "default" : "destructive"}
        onBack={() => router.push("/sales/price-books")}
      />

      <Tabs defaultValue="details">
        <TabsList className="justify-start border-b border-gray-300">
          <TabsTrigger value="details" className="text-base font-medium">
            Details
          </TabsTrigger>
          <TabsTrigger value="entries" className="text-base font-medium">
            Entries ({entries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContents className="mt-4">
          {/* ── Details Tab ───────────────────────────── */}
          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Main info */}
              <div className="lg:col-span-2 space-y-4">
                <DetailCard
                  title="Price Book Information"
                  className="bg-gray-50/50 border-gray-200"
                >
                  <InfoGrid columns={2}>
                    <InfoField label="Name" value={pb.name} />
                    <InfoField
                      label="Currency"
                      value={pb.currencyISOCode ?? "—"}
                    />
                    <div className="space-y-1.5">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Status
                      </p>
                      <Badge
                        variant={pb.isActive ? "default" : "destructive"}
                        className="px-2 py-1"
                      >
                        {pb.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <InfoField label="Price Book ID" value={String(pb.id)} />
                  </InfoGrid>

                  {pb.description && (
                    <div className="mt-4 pt-4 border-t">
                      <InfoField label="Description" value={pb.description} />
                    </div>
                  )}
                </DetailCard>
              </div>

              {/* System info sidebar */}
              <div className="space-y-4">
                <DetailCard
                  title="System Information"
                  className="bg-gray-50/50 border-gray-200"
                >
                  <InfoGrid columns={1}>
                    <InfoField
                      label="Created At"
                      value={new Date(pb.createdAt).toLocaleDateString(
                        "en-GB",
                        {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    />
                    <InfoField
                      label="Last Modified"
                      value={new Date(pb.updatedAt).toLocaleDateString(
                        "en-GB",
                        {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    />
                    <InfoField
                      label="Total Entries"
                      value={entriesLoading ? "…" : String(entries.length)}
                    />
                  </InfoGrid>
                </DetailCard>
              </div>
            </div>
          </TabsContent>

          {/* ── Entries Tab ───────────────────────────── */}
          <TabsContent value="entries">
            <DataTable
              title="Price Book Entries"
              data={entries}
              columns={entryColumns}
              count={entries.length}
              columnPreferenceKey="pricebook-entries"
            />
          </TabsContent>
        </TabsContents>
      </Tabs>
    </div>
  );
}
