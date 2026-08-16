"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryStates, parseAsString } from "nuqs";
import {
  Badge,
  Button,
  DetailCard,
  DetailPageHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";
import {
  Hash,
  Tag,
  CheckCircle2,
  Building2,
  User,
  Calendar,
  Clock,
  FileText,
  Link2,
  StickyNote,
  CreditCard,
  Truck,
  Download,
  Loader2,
} from "lucide-react";
import {
  useQuote,
  useQuoteLineItems,
  useQuoteOrder,
  useGenerateOrder,
  useSetPrimaryQuote,
  useUpdateQuoteStatus,
  QUOTE_STATUS_API_VALUES,
} from "@/hooks/useQuotes";
import { quoteService } from "@/lib/api/services";
import { toast } from "@/lib/toast";
import {
  QuoteLineItemsTable,
  type QuoteLineItemRow,
} from "./quote-line-items-table";
import { ApplyForApprovalDialog } from "@/components/approvals/apply-for-approval-dialog";
import type { QuoteLineItemApi } from "@/lib/api/types";
import { DetailPageSkeleton } from "@/components/skeletons";

type QuoteDetailPageProps = {
  quoteId: string;
};

function formatDateTime(iso: string | undefined) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(iso: string | undefined) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function toNum(v: number | string | undefined): number {
  if (v === undefined || v === null) return 0;
  return typeof v === "number" ? v : Number(v) || 0;
}

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString()}`;
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800 border-amber-200",
  IN_REVIEW: "bg-blue-100 text-blue-800 border-blue-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  PRESENTED: "bg-purple-100 text-purple-800 border-purple-200",
  ACCEPTED: "bg-green-100 text-green-800 border-green-200",
};

function mapApiLineItemToRow(item: QuoteLineItemApi): QuoteLineItemRow {
  const productName = item.product?.name ?? "—";
  const productCode = item.product?.code ?? "—";
  const listPrice =
    typeof item.listPrice === "number"
      ? item.listPrice
      : Number(item.listPrice) || 0;
  const unitPrice =
    typeof item.unitPrice === "number"
      ? item.unitPrice
      : Number(item.unitPrice) || 0;
  const discount =
    typeof item.discount === "number"
      ? item.discount
      : Number(item.discount) || 0;
  const totalPrice =
    typeof item.totalPrice === "number"
      ? item.totalPrice
      : Number(item.totalPrice) || 0;
  return {
    id: String(item.id),
    productName,
    productCode,
    quantity: item.quantity,
    listPrice,
    discount,
    unitPrice,
    totalPrice,
  };
}

export function QuoteDetailPage({ quoteId }: QuoteDetailPageProps) {
  const router = useRouter();
  const [lineItemsPage, setLineItemsPage] = React.useState(1);
  const [lineItemsPerPage, setLineItemsPerPage] = React.useState(10);
  const [tabState, setTabState] = useQueryStates(
    { tab: parseAsString.withDefault("details") },
    { history: "push", shallow: true }
  );
  const tab = (tabState.tab === "line-items" ? "line-items" : "details") as
    | "details"
    | "line-items";

  const { data: quote, isLoading, isError, error } = useQuote(quoteId);
  const {
    data: lineItemsData = [],
    pagination: lineItemsPagination,
    isLoading: lineItemsLoading,
  } = useQuoteLineItems(quoteId, {
    page: lineItemsPage,
    limit: lineItemsPerPage,
  });
  const setPrimaryMutation = useSetPrimaryQuote(quoteId);
  const updateStatusMutation = useUpdateQuoteStatus(quoteId);
  const { data: linkedOrder } = useQuoteOrder(quoteId);
  const generateOrderMutation = useGenerateOrder(quoteId);

  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownloadPdf = React.useCallback(async () => {
    setIsDownloading(true);
    try {
      await quoteService.downloadPdf(
        Number(quoteId),
        quote?.quoteNumber ?? quoteId
      );
      toast.success("PDF downloaded successfully!");
    } catch {
      toast.error("Failed to download PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }, [quoteId, quote?.quoteNumber]);

  const handleGenerateOrder = React.useCallback(() => {
    generateOrderMutation.mutate(undefined, {
      onSuccess: () => toast.success("Sales order generated successfully!"),
      onError: (err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to generate order. Please try again.";
        toast.error(message);
      },
    });
  }, [generateOrderMutation]);

  const lineItemRows = React.useMemo(
    () => lineItemsData.map(mapApiLineItemToRow),
    [lineItemsData]
  );
  const [applyForApprovalOpen, setApplyForApprovalOpen] = React.useState(false);
  const [setPrimaryOpen, setSetPrimaryOpen] = React.useState(false);

  const setTab = React.useCallback(
    (value: string) => {
      setTabState({ tab: value === "line-items" ? "line-items" : "details" });
    },
    [setTabState]
  );

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (isError || !quote) {
    return (
      <div className="space-y-5 p-4">
        <div className="text-lg font-semibold">Quote not found</div>
        {error && typeof error === "object" && "message" in error && (
          <p className="text-sm text-muted-foreground">
            {(error as { message: string }).message}
          </p>
        )}
        <Button variant="outline" onClick={() => router.push("/sales/quotes")}>
          Back to Quotes
        </Button>
      </div>
    );
  }

  const statusBadgeClass =
    STATUS_BADGE_CLASSES[quote.status] ??
    "bg-gray-100 text-gray-800 border-gray-200";
  const grandTotalNum = toNum(quote.grandTotal);
  const preparedByName = quote.preparedBy
    ? [quote.preparedBy.firstName, quote.preparedBy.lastName]
        .filter(Boolean)
        .join(" ") || "—"
    : "—";
  const approvedByName = quote.approvedBy
    ? [quote.approvedBy.firstName, quote.approvedBy.lastName]
        .filter(Boolean)
        .join(" ") || "—"
    : "—";
  const rejectedByName = quote.rejectedBy
    ? [quote.rejectedBy.firstName, quote.rejectedBy.lastName]
        .filter(Boolean)
        .join(" ") || "—"
    : "—";

  return (
    <div className="p-4 space-y-6">
      <DetailPageHeader
        title={quote.quoteNumber}
        status={quote.status}
        statusVariant="secondary"
        onBack={() => router.push("/sales/quotes")}
        headerRight={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isDownloading ? "Generating..." : "Download PDF"}
            </Button>

            {quote.status === "DRAFT" && (
              <Button
                variant="default"
                onClick={() => setApplyForApprovalOpen(true)}
              >
                Apply for Approval
              </Button>
            )}

            {linkedOrder ? (
              <Button
                variant="outline"
                onClick={() => router.push(`/sales/orders/${linkedOrder.id}`)}
              >
                View Order
              </Button>
            ) : (
              (() => {
                const isDisabled =
                  quote.status !== "ACCEPTED" ||
                  generateOrderMutation.isPending;
                return (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="default"
                            disabled={isDisabled}
                            onClick={handleGenerateOrder}
                            style={
                              isDisabled ? { pointerEvents: "none" } : undefined
                            }
                          >
                            {generateOrderMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating…
                              </>
                            ) : (
                              "Generate Order"
                            )}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {isDisabled && !generateOrderMutation.isPending && (
                        <TooltipContent>
                          You can generate order when quote is accepted
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                );
              })()
            )}

            <Select
              value={quote.status}
              onValueChange={value => updateStatusMutation.mutate(value)}
              disabled={updateStatusMutation.isPending}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <span className="flex-1 text-left">
                  Status: {quote.status || "—"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {/* ACCEPTED and APPROVED are set exclusively via the approval workflow,
                    not via manual override, to prevent bypassing the approval flow.
                    The current value is always shown regardless. */}
                {QUOTE_STATUS_API_VALUES.filter(
                  s => s !== "ACCEPTED" && s !== "APPROVED"
                ).map(s => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
                {(quote.status === "ACCEPTED" ||
                  quote.status === "APPROVED") && (
                  <SelectItem key={quote.status} value={quote.status} disabled>
                    {quote.status} (set via approval)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <ApplyForApprovalDialog
        open={applyForApprovalOpen}
        onOpenChange={setApplyForApprovalOpen}
        quoteId={String(quote.id)}
        quoteNumber={quote.quoteNumber}
        createdBy={preparedByName}
      />

      <Dialog open={setPrimaryOpen} onOpenChange={setSetPrimaryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set as primary</DialogTitle>
            <DialogDescription>
              Do you want to set this quote as primary? This will unset the
              current primary quote for this opportunity.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSetPrimaryOpen(false)}
              disabled={setPrimaryMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setPrimaryMutation.mutate(undefined, {
                  onSuccess: () => setSetPrimaryOpen(false),
                  onError: () => {},
                });
              }}
              disabled={setPrimaryMutation.isPending}
            >
              {setPrimaryMutation.isPending ? "Setting…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Financial banner */}
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 p-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-75">
          Grand Total
        </p>
        <p className="mt-1 text-3xl font-bold">
          {formatCurrency(grandTotalNum)}
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm opacity-90">
          <div>
            <p className="text-xs opacity-75 uppercase tracking-wider">
              Quote No
            </p>
            <p className="font-semibold">{quote.quoteNumber}</p>
          </div>
          <div>
            <p className="text-xs opacity-75 uppercase tracking-wider">
              Primary
            </p>
            <p className="font-semibold">{quote.isPrimary ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-xs opacity-75 uppercase tracking-wider">
              Status
            </p>
            <p className="font-semibold">{quote.status}</p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="justify-start space-x-16 border-b border-gray-300">
          <TabsTrigger
            value="details"
            className="text-lg font-medium data-[state=active]:border-b-[3px] data-[state=active]:border-gray-700"
          >
            Details
          </TabsTrigger>
          <TabsTrigger
            value="line-items"
            className="text-lg font-medium data-[state=active]:border-b-[3px] data-[state=active]:border-gray-700"
          >
            Line Items
          </TabsTrigger>
        </TabsList>

        <TabsContents className="mt-8">
          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-6">
                <DetailCard
                  title="Quote Information"
                  className="bg-white border-gray-200"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                        <Hash className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Quote Number
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {quote.quoteNumber}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50">
                        <Tag className="h-3.5 w-3.5 text-violet-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Name
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {quote.name || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Status
                        </p>
                        <Badge className={statusBadgeClass}>
                          {quote.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-50">
                        <CheckCircle2 className="h-3.5 w-3.5 text-sky-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Primary
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-700">
                            {quote.isPrimary ? "Yes" : "No"}
                          </p>
                          {!quote.isPrimary && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs text-primary"
                              onClick={() => setSetPrimaryOpen(true)}
                            >
                              Set primary
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    {quote.type != null && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-fuchsia-50">
                          <Tag className="h-3.5 w-3.5 text-fuchsia-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                            Type
                          </p>
                          <p className="text-sm font-medium text-gray-700">
                            {quote.type}
                          </p>
                        </div>
                      </div>
                    )}
                    {quote.version != null && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-50">
                          <Hash className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                            Version
                          </p>
                          <p className="text-sm font-medium text-gray-700">
                            {String(quote.version)}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-50">
                        <Building2 className="h-3.5 w-3.5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Account
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {quote.account ? quote.account.name : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50">
                        <Link2 className="h-3.5 w-3.5 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Opportunity
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {quote.opportunity ? quote.opportunity.name : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-pink-50">
                        <User className="h-3.5 w-3.5 text-pink-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Primary Contact
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {quote.contact
                            ? `${quote.contact.name}${quote.contact.email ? ` (${quote.contact.email})` : ""}`
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50">
                        <Calendar className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Valid Until
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(quote.validUntil ?? undefined)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                        <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Payment Terms
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {quote.paymentTerms ?? "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-50">
                        <Truck className="h-3.5 w-3.5 text-teal-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Delivery Terms
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {quote.deliveryTerms ?? "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Financial breakdown */}
                  <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      {
                        label: "Subtotal",
                        value: formatCurrency(toNum(quote.subtotal)),
                      },
                      {
                        label: "Discount",
                        value: formatCurrency(toNum(quote.discount)),
                      },
                      {
                        label: "Discount %",
                        value: `${toNum(quote.discountPercent)}%`,
                      },
                      {
                        label: "Tax Amount",
                        value: formatCurrency(toNum(quote.taxAmount)),
                      },
                      { label: "Tax %", value: `${toNum(quote.taxPercent)}%` },
                      {
                        label: "Shipping",
                        value: formatCurrency(toNum(quote.shippingAmount)),
                      },
                    ].map(item => (
                      <div
                        key={item.label}
                        className="rounded-lg border p-3 bg-gray-50 border-gray-200"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          {item.label}
                        </p>
                        <p className="text-sm font-semibold text-gray-700">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Notes / Internal Notes / Description */}
                  {(quote.notes ||
                    quote.internalNotes ||
                    quote.description) && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      {quote.notes && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100">
                            <StickyNote className="h-3.5 w-3.5 text-gray-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Notes
                            </p>
                            <p className="text-sm font-medium text-gray-700 whitespace-pre-wrap">
                              {quote.notes}
                            </p>
                          </div>
                        </div>
                      )}
                      {quote.internalNotes && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50">
                            <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Internal Notes
                            </p>
                            <p className="text-sm font-medium text-gray-700 whitespace-pre-wrap">
                              {quote.internalNotes}
                            </p>
                          </div>
                        </div>
                      )}
                      {quote.description && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100">
                            <FileText className="h-3.5 w-3.5 text-gray-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Description
                            </p>
                            <p className="text-sm font-medium text-gray-700 whitespace-pre-wrap">
                              {quote.description}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </DetailCard>

                {(quote.billingName ||
                  quote.billingStreet ||
                  quote.shippingName ||
                  quote.shippingStreet) && (
                  <DetailCard
                    title="Addresses"
                    className="bg-white border-gray-200"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                          <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                            Billing Address
                          </p>
                          <div className="text-sm font-medium text-gray-700 space-y-0.5">
                            {quote.billingName && <p>{quote.billingName}</p>}
                            {quote.billingStreet && (
                              <p>{quote.billingStreet}</p>
                            )}
                            {(quote.billingCity ||
                              quote.billingState ||
                              quote.billingPostalCode) && (
                              <p className="text-gray-500">
                                {[
                                  quote.billingCity,
                                  quote.billingState,
                                  quote.billingPostalCode,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            )}
                            {quote.billingCountry && (
                              <p className="text-gray-500">
                                {quote.billingCountry}
                              </p>
                            )}
                            {!quote.billingName &&
                              !quote.billingStreet &&
                              !quote.billingCity &&
                              !quote.billingCountry && <p>N/A</p>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-50">
                          <Truck className="h-3.5 w-3.5 text-teal-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                            Shipping Address
                          </p>
                          <div className="text-sm font-medium text-gray-700 space-y-0.5">
                            {quote.shippingName && <p>{quote.shippingName}</p>}
                            {quote.shippingStreet && (
                              <p>{quote.shippingStreet}</p>
                            )}
                            {(quote.shippingCity ||
                              quote.shippingState ||
                              quote.shippingPostalCode) && (
                              <p className="text-gray-500">
                                {[
                                  quote.shippingCity,
                                  quote.shippingState,
                                  quote.shippingPostalCode,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            )}
                            {quote.shippingCountry && (
                              <p className="text-gray-500">
                                {quote.shippingCountry}
                              </p>
                            )}
                            {!quote.shippingName &&
                              !quote.shippingStreet &&
                              !quote.shippingCity &&
                              !quote.shippingCountry && <p>N/A</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </DetailCard>
                )}

                {(quote.approvalComment || quote.rejectionComment) && (
                  <DetailCard
                    title="Approval / Rejection"
                    className="bg-white border-gray-200"
                  >
                    <div className="space-y-3">
                      {quote.approvalComment && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green-50">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Approval Comment
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {quote.approvalComment}
                            </p>
                          </div>
                        </div>
                      )}
                      {quote.rejectionComment && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-50">
                            <StickyNote className="h-3.5 w-3.5 text-red-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Rejection Comment
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {quote.rejectionComment}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </DetailCard>
                )}
              </div>

              <div className="h-full space-y-6">
                <DetailCard
                  title="System Information"
                  className="bg-white border-gray-200"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50">
                        <User className="h-3.5 w-3.5 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Prepared By
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {preparedByName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Created At
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {formatDateTime(quote.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-50">
                        <Clock className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Updated At
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {formatDateTime(quote.updatedAt)}
                        </p>
                      </div>
                    </div>
                    {quote.approvedAt && (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green-50">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Approved By
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {approvedByName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green-50">
                            <Calendar className="h-3.5 w-3.5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Approved At
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {formatDateTime(quote.approvedAt)}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                    {quote.rejectedAt && (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-50">
                            <User className="h-3.5 w-3.5 text-red-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Rejected By
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {rejectedByName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-50">
                            <Calendar className="h-3.5 w-3.5 text-red-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                              Rejected At
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {formatDateTime(quote.rejectedAt)}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                    {quote.presentedAt && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-50">
                          <Clock className="h-3.5 w-3.5 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                            Presented At
                          </p>
                          <p className="text-sm font-medium text-gray-700">
                            {formatDateTime(quote.presentedAt)}
                          </p>
                        </div>
                      </div>
                    )}
                    {quote.acceptedAt && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green-50">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                            Accepted At
                          </p>
                          <p className="text-sm font-medium text-gray-700">
                            {formatDateTime(quote.acceptedAt)}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-50">
                        <Hash className="h-3.5 w-3.5 text-sky-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Line Items
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {String(quote._count?.lineItems ?? 0)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-50">
                        <Hash className="h-3.5 w-3.5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                          Sales Orders
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                          {String(quote._count?.salesOrders ?? 0)}
                        </p>
                      </div>
                    </div>
                    {quote.pdfUrl && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100">
                          <FileText className="h-3.5 w-3.5 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                            PDF
                          </p>
                          <a
                            href={quote.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 hover:underline"
                          >
                            View PDF
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </DetailCard>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="line-items">
            {lineItemsLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading line items...
              </div>
            ) : (
              <QuoteLineItemsTable
                items={lineItemRows}
                count={lineItemsPagination?.totalItems ?? 0}
                currentPage={lineItemsPage}
                totalPages={lineItemsPagination?.totalPages ?? 1}
                itemsPerPage={lineItemsPerPage}
                onPageChange={setLineItemsPage}
                onItemsPerPageChange={n => {
                  setLineItemsPerPage(n);
                  setLineItemsPage(1);
                }}
                onRowClick={item =>
                  router.push(`/sales/quotes/${quoteId}/line-items/${item.id}`)
                }
              />
            )}
          </TabsContent>
        </TabsContents>
      </Tabs>
    </div>
  );
}
