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
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Tabs,
  TabsContent,
  TabsContents,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Textarea,
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
} from "@repo/ui/icons";
import {
  useQuote,
  useQuoteLineItems,
  useQuoteOrder,
  useGenerateOrder,
  useSetPrimaryQuote,
  useUpdateQuoteStatus,
  useSendQuoteToClient,
  QUOTE_STATUS_API_VALUES,
} from "@/hooks/use-quotes";
import { quoteService } from "@/lib/api/services";
import { toast } from "@/lib/toast";
import {
  QuoteLineItemsTable,
  type QuoteLineItemRow,
} from "./quote-line-items-table";
import { ApplyForApprovalDialog } from "@/components/approvals/apply-for-approval-dialog";
import type { QuoteLineItemApi } from "@/lib/api/types";
import { DetailPageSkeleton } from "@/components/skeletons";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { DEFAULT_PAGE_SIZE } from "@/components/data-table";
import { statusTone } from "@repo/ui/components/ui/status-badge";
import { Tag as StatusTag } from "@repo/ui/components/ui/tag";
import { formatMoney } from "@/lib/utils/decimal";
import { CategorySwitcher } from "@repo/ui/components/ui/category-switcher";

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
  return formatMoney(n);
}

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
  const [lineItemsPerPage, setLineItemsPerPage] =
    React.useState(DEFAULT_PAGE_SIZE);
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
  const sendQuoteMutation = useSendQuoteToClient(quoteId);

  const [isDownloading, setIsDownloading] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [recipient, setRecipient] = React.useState("");
  const [sendSubject, setSendSubject] = React.useState("");
  const [sendMessage, setSendMessage] = React.useState("");

  React.useEffect(() => {
    if (sendOpen && !recipient && quote?.contact?.email) {
      setRecipient(quote.contact.email);
    }
  }, [quote?.contact?.email, recipient, sendOpen]);

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

  const handleSendQuote = React.useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      sendQuoteMutation.mutate(
        {
          to: recipient.trim(),
          subject: sendSubject.trim() || undefined,
          message: sendMessage.trim() || undefined,
        },
        {
          onSuccess: () => {
            toast.success("Quote sent to the client");
            setSendOpen(false);
          },
          onError: error => toast.error(error, "Quote delivery failed"),
        }
      );
    },
    [recipient, sendMessage, sendQuoteMutation, sendSubject]
  );

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
      <PageShell>
        <div className="text-lg font-semibold">Quote not found</div>
        {error && typeof error === "object" && "message" in error && (
          <p className="text-sm text-muted-foreground">
            {(error as { message: string }).message}
          </p>
        )}
        <Button variant="outline" onClick={() => router.push("/sales/quotes")}>
          Back to Quotes
        </Button>
      </PageShell>
    );
  }

  const grandTotalNum = toNum(quote.grandTotal);
  const preparedByName = quote.preparedBy
    ? [quote.preparedBy.firstName, quote.preparedBy.lastName]
        .filter(Boolean)
        .join(" ") || "—"
    : "—";
  const manualStatusOptions =
    quote.status === "PRESENTED"
      ? ["PRESENTED", "ACCEPTED", "REJECTED"]
      : quote.status === "REJECTED"
        ? ["REJECTED", "DRAFT"]
        : [quote.status];
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
    <div className="p-4 space-y-4">
      <DetailPageHeader
        title={quote.quoteNumber}
        status={quote.status}
        statusTone={statusTone(quote.status)}
        onBack={() => router.push("/sales/quotes")}
        headerRight={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
            >
              {isDownloading ? null : <Download className="h-4 w-4" />}
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

            {(quote.status === "APPROVED" || quote.status === "PRESENTING") && (
              <Button
                variant="default"
                onClick={() => setSendOpen(true)}
                disabled={sendQuoteMutation.isPending}
              >
                {quote.status === "PRESENTING"
                  ? "Retry delivery"
                  : "Send to client"}
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
                              <>Generating…</>
                            ) : (
                              "Generate Order"
                            )}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {isDisabled && !generateOrderMutation.isPending && (
                        <TooltipContent>
                          You can turn this quote into an order once the
                          customer has accepted it.
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
              disabled={
                updateStatusMutation.isPending ||
                manualStatusOptions.length === 1
              }
            >
              <SelectTrigger className="w-full sm:w-[12.5rem]">
                <span className="flex-1 text-left">
                  Status: {quote.status || "—"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {QUOTE_STATUS_API_VALUES.filter(s =>
                  manualStatusOptions.includes(s)
                ).map(s => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
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

      <Dialog
        open={sendOpen}
        onOpenChange={open => {
          setSendOpen(open);
          if (!open) sendQuoteMutation.reset();
        }}
      >
        <DialogContent className="max-w-lg gap-0 overflow-hidden">
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={handleSendQuote}
          >
            <DialogHeader>
              <DialogTitle>Send quote to client</DialogTitle>
              <DialogDescription>
                The approved quote PDF will be attached to this email. Delivery
                is retry-safe if the mail provider times out.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="quote-recipient">Recipient</Label>
                <Input
                  id="quote-recipient"
                  type="email"
                  required
                  maxLength={254}
                  value={recipient}
                  onChange={event => setRecipient(event.target.value)}
                  placeholder="client@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-subject">Subject (optional)</Label>
                <Input
                  id="quote-subject"
                  maxLength={200}
                  value={sendSubject}
                  onChange={event => setSendSubject(event.target.value)}
                  placeholder={`Quote ${quote.quoteNumber} from Ralli Wolf Operations`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-message">Message (optional)</Label>
                <Textarea
                  id="quote-message"
                  maxLength={5000}
                  rows={5}
                  value={sendMessage}
                  onChange={event => setSendMessage(event.target.value)}
                  placeholder="Add a short note for the client"
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSendOpen(false)}
                disabled={sendQuoteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!recipient.trim() || sendQuoteMutation.isPending}
              >
                {sendQuoteMutation.isPending ? "Sending…" : "Send quote"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                });
              }}
              disabled={setPrimaryMutation.isPending}
            >
              {setPrimaryMutation.isPending ? "Setting…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl bg-info-surface border border-info-border p-4 text-info-foreground">
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
        <CategorySwitcher
          label="Quote sections"
          items={[
            { value: "details", label: "Details" },
            { value: "line-items", label: "Line items" },
          ]}
        />

        <TabsContents>
          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <DetailCard
                  title="Quote Information"
                  className="bg-surface border-border"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info-surface">
                        <Hash className="h-3.5 w-3.5 text-info" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Quote Number
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {quote.quoteNumber}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Name
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {quote.name || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success-surface">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Status
                        </p>
                        <StatusTag tone={statusTone(quote.status)}>
                          {quote.status}
                        </StatusTag>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Primary
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-text-secondary">
                            {quote.isPrimary ? "Yes" : "No"}
                          </p>
                          {!quote.isPrimary && (
                            <Button
                              variant="link"
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
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Type
                          </p>
                          <p className="text-sm font-medium text-text-secondary">
                            {quote.type}
                          </p>
                        </div>
                      </div>
                    )}
                    {quote.version != null && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-elevated">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Version
                          </p>
                          <p className="text-sm font-medium text-text-secondary">
                            {String(quote.version)}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warning-surface">
                        <Building2 className="h-3.5 w-3.5 text-warning" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Account
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {quote.account ? quote.account.name : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-surface">
                        <Link2 className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Opportunity
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {quote.opportunity ? quote.opportunity.name : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Primary Contact
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {quote.contact
                            ? `${quote.contact.name}${quote.contact.email ? ` (${quote.contact.email})` : ""}`
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warning-surface">
                        <Calendar className="h-3.5 w-3.5 text-warning" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Valid Until
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {formatDate(quote.validUntil ?? undefined)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info-surface">
                        <CreditCard className="h-3.5 w-3.5 text-info" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Payment Terms
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {quote.paymentTerms ?? "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                        <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Delivery Terms
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {quote.deliveryTerms ?? "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-subtle grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                        className="rounded-lg border p-3 bg-surface-elevated border-border"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          {item.label}
                        </p>
                        <p className="text-sm font-semibold text-text-secondary">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {(quote.notes ||
                    quote.internalNotes ||
                    quote.description) && (
                    <div className="mt-4 pt-4 border-t border-subtle space-y-3">
                      {quote.notes && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                            <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Notes
                            </p>
                            <p className="text-sm font-medium text-text-secondary whitespace-pre-wrap">
                              {quote.notes}
                            </p>
                          </div>
                        </div>
                      )}
                      {quote.internalNotes && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warning-surface">
                            <StickyNote className="h-3.5 w-3.5 text-warning" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Internal Notes
                            </p>
                            <p className="text-sm font-medium text-text-secondary whitespace-pre-wrap">
                              {quote.internalNotes}
                            </p>
                          </div>
                        </div>
                      )}
                      {quote.description && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Description
                            </p>
                            <p className="text-sm font-medium text-text-secondary whitespace-pre-wrap">
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
                    className="bg-surface border-border"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info-surface">
                          <CreditCard className="h-3.5 w-3.5 text-info" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            Billing Address
                          </p>
                          <div className="text-sm font-medium text-text-secondary space-y-0.5">
                            {quote.billingName && <p>{quote.billingName}</p>}
                            {quote.billingStreet && (
                              <p>{quote.billingStreet}</p>
                            )}
                            {(quote.billingCity ||
                              quote.billingState ||
                              quote.billingPostalCode) && (
                              <p className="text-muted-foreground">
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
                              <p className="text-muted-foreground">
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
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            Shipping Address
                          </p>
                          <div className="text-sm font-medium text-text-secondary space-y-0.5">
                            {quote.shippingName && <p>{quote.shippingName}</p>}
                            {quote.shippingStreet && (
                              <p>{quote.shippingStreet}</p>
                            )}
                            {(quote.shippingCity ||
                              quote.shippingState ||
                              quote.shippingPostalCode) && (
                              <p className="text-muted-foreground">
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
                              <p className="text-muted-foreground">
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
                    className="bg-surface border-border"
                  >
                    <div className="space-y-3">
                      {quote.approvalComment && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success-surface">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Approval Comment
                            </p>
                            <p className="text-sm font-medium text-text-secondary">
                              {quote.approvalComment}
                            </p>
                          </div>
                        </div>
                      )}
                      {quote.rejectionComment && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-error-surface">
                            <StickyNote className="h-3.5 w-3.5 text-destructive" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Rejection Comment
                            </p>
                            <p className="text-sm font-medium text-text-secondary">
                              {quote.rejectionComment}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </DetailCard>
                )}
              </div>

              <div className="h-full space-y-4">
                <DetailCard
                  title="System Information"
                  className="bg-surface border-border"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-surface">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Prepared By
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {preparedByName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info-surface">
                        <Clock className="h-3.5 w-3.5 text-info" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Created At
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {formatDateTime(quote.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Updated At
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {formatDateTime(quote.updatedAt)}
                        </p>
                      </div>
                    </div>
                    {quote.approvedAt && (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success-surface">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Approved By
                            </p>
                            <p className="text-sm font-medium text-text-secondary">
                              {approvedByName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success-surface">
                            <Calendar className="h-3.5 w-3.5 text-success" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Approved At
                            </p>
                            <p className="text-sm font-medium text-text-secondary">
                              {formatDateTime(quote.approvedAt)}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                    {quote.rejectedAt && (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-error-surface">
                            <User className="h-3.5 w-3.5 text-destructive" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Rejected By
                            </p>
                            <p className="text-sm font-medium text-text-secondary">
                              {rejectedByName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-error-surface">
                            <Calendar className="h-3.5 w-3.5 text-destructive" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Rejected At
                            </p>
                            <p className="text-sm font-medium text-text-secondary">
                              {formatDateTime(quote.rejectedAt)}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                    {quote.presentedAt && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Presented At
                          </p>
                          <p className="text-sm font-medium text-text-secondary">
                            {formatDateTime(quote.presentedAt)}
                          </p>
                        </div>
                      </div>
                    )}
                    {quote.acceptedAt && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success-surface">
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Accepted At
                          </p>
                          <p className="text-sm font-medium text-text-secondary">
                            {formatDateTime(quote.acceptedAt)}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Line Items
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {String(quote._count?.lineItems ?? 0)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warning-surface">
                        <Hash className="h-3.5 w-3.5 text-warning" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Sales Orders
                        </p>
                        <p className="text-sm font-medium text-text-secondary">
                          {String(quote._count?.salesOrders ?? 0)}
                        </p>
                      </div>
                    </div>
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
              />
            )}
          </TabsContent>
        </TabsContents>
      </Tabs>
    </div>
  );
}
