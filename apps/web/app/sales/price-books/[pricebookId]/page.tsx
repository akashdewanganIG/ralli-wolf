"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { usePricebook } from "@/hooks/use-pricebooks";
import { usePricebookEntriesByPriceBookId } from "@/hooks/use-pricebook-entries";
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
  TabsContent,
  TabsContents,
} from "@repo/ui";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { formatMoney } from "@/lib/utils/decimal";
import { CategorySwitcher } from "@repo/ui/components/ui/category-switcher";

const buildEntryColumns = (
  currencyCode?: string
): TableColumn<PriceBookEntry>[] => [
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
    render: listPrice =>
      formatMoney(listPrice as string | number, currencyCode),
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
  const priceBookId = /^\d+$/.test(pricebookId) ? Number(pricebookId) : 0;
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

  const pb = pbData;

  if (pbError || !pb) {
    return (
      <PageShell>
        <div className="text-lg font-semibold">Price book not found</div>
        <button
          type="button"
          className="text-sm text-muted-foreground transition-colors hover:text-info"
          onClick={() => router.push("/sales/price-books")}
        >
          Back to Price Books
        </button>
      </PageShell>
    );
  }
  const entries = entriesData?.data ?? [];

  return (
    <PageShell>
      <DetailPageHeader
        title={pb.name}
        status={pb.isActive ? "Active" : "Inactive"}
        statusTone={pb.isActive ? "active" : "neutral"}
        onBack={() => router.push("/sales/price-books")}
      />

      <Tabs defaultValue="details">
        <CategorySwitcher
          label="Price book sections"
          items={[
            { value: "details", label: "Details" },
            { value: "entries", label: "Entries", count: entries.length },
          ]}
        />

        <TabsContents>
          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <DetailCard
                  title="Price Book Information"
                  className="bg-surface-elevated/50 border-border"
                >
                  <InfoGrid columns={2}>
                    <InfoField label="Name" value={pb.name} />
                    <InfoField label="Currency" value={pb.currencyCode} />
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

              <div className="space-y-4">
                <DetailCard
                  title="System Information"
                  className="bg-surface-elevated/50 border-border"
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

          <TabsContent value="entries">
            <DataTable
              title="Price Book Entries"
              data={entries}
              columns={buildEntryColumns(pb.currencyCode)}
              count={entries.length}
              columnPreferenceKey="pricebook-entries"
            />
          </TabsContent>
        </TabsContents>
      </Tabs>
    </PageShell>
  );
}
