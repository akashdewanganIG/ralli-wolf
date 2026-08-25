"use client";

import * as React from "react";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { Tag } from "@repo/ui/components/ui/tag";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ErrorBanner,
  Field,
  PageHeader,
  Panel,
  SimpleTable,
  StatCard,
} from "@/components/supply-chain/shared";
import {
  useFinanceMutations,
  usePayables,
  useReceivables,
  useUninvoiced,
} from "@/hooks/useFinance";
import type {
  CustomerInvoiceRow,
  SupplierInvoiceRow,
} from "@/lib/api/financeServices";
import { formatDate, formatMoney } from "@/lib/utils/decimal";
import { DataTransfer } from "@/components/data-transfer/DataTransfer";

type Side = "PAYABLE" | "RECEIVABLE";

/** A received purchase order or a shipped sales order, flattened to one shape. */
type BillableRow = {
  id: number;
  number: string;
  party: string;
  orderDate: string | null;
  value: string | null;
  currencyCode: string;
};

const STATUS_TONE: Record<
  string,
  "neutral" | "active" | "progress" | "pending" | "danger"
> = {
  DRAFT: "neutral",
  AWAITING_APPROVAL: "pending",
  APPROVED: "progress",
  PARTIALLY_PAID: "pending",
  PAID: "active",
  CANCELLED: "neutral",
  WRITTEN_OFF: "danger",
};

/**
 * Accounts payable and receivable share a shape: a list of invoices, each with
 * an outstanding balance and a due date, and one action — settle some of it.
 * One component serves both so the two ledgers cannot drift apart in either
 * behaviour or layout.
 */
export function InvoiceLedger({ side }: { side: Side }) {
  const isPayable = side === "PAYABLE";
  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [paying, setPaying] = React.useState<
    SupplierInvoiceRow | CustomerInvoiceRow | null
  >(null);
  const [amount, setAmount] = React.useState("");
  const [reference, setReference] = React.useState("");

  const payables = usePayables(
    isPayable ? { overdue: overdueOnly } : undefined
  );
  const receivables = useReceivables(
    !isPayable ? { overdue: overdueOnly } : undefined
  );
  const uninvoiced = useUninvoiced();
  const { recordPayment, approvePayable, createPayable, createReceivable } =
    useFinanceMutations();

  const query = isPayable ? payables : receivables;
  // No data is no data, whether it is still coming or never arrived.
  const unknown = query.isLoading || Boolean(query.error);
  const queryData = query.data?.data;
  const rows = React.useMemo(
    () => (queryData ?? []) as (SupplierInvoiceRow & CustomerInvoiceRow)[],
    [queryData]
  );

  // Totals belong to one currency. The headline is whichever currency carries
  // the most invoices on screen; the rest are named rather than added in, for
  // the same reason the API refuses to add them.
  const totals = React.useMemo(() => {
    const per = new Map<
      string,
      { outstanding: number; overdue: number; n: number }
    >();
    for (const r of rows) {
      const left = Number(r.outstanding);
      const acc = per.get(r.currencyCode) ?? {
        outstanding: 0,
        overdue: 0,
        n: 0,
      };
      acc.outstanding += left;
      acc.n += 1;
      if (r.ageing.days > 0 && left > 0) acc.overdue += left;
      per.set(r.currencyCode, acc);
    }
    const primary = [...per.entries()].sort((a, b) => b[1].n - a[1].n)[0];
    return {
      currencyCode: primary?.[0] ?? "INR",
      outstanding: primary?.[1].outstanding ?? 0,
      overdue: primary?.[1].overdue ?? 0,
      shown: primary?.[1].n ?? 0,
      others: [...per.keys()].filter(c => c !== primary?.[0]).sort(),
    };
  }, [rows]);

  // The two sides carry different field names for the same four facts, so they
  // are normalised once here rather than being branched on in every cell.
  const billable: BillableRow[] = React.useMemo(() => {
    const d = uninvoiced.data?.data;
    if (!d) return [];
    return isPayable
      ? d.purchaseOrders.map(po => ({
          id: po.id,
          number: po.poNumber,
          party: po.supplier.name,
          orderDate: po.orderDate,
          value: po.grandTotal,
          currencyCode: po.currencyCode,
        }))
      : d.salesOrders.map(so => ({
          id: so.id,
          number: so.orderNumber,
          party: so.account.name,
          orderDate: so.orderDate,
          value: so.grandTotal,
          currencyCode: "INR",
        }));
  }, [uninvoiced.data, isPayable]);

  const openPayment = (row: SupplierInvoiceRow | CustomerInvoiceRow) => {
    setPaying(row);
    // Pre-fill with the full balance: settling in full is the common case, and
    // it is easier to reduce a number than to type one.
    setAmount(row.outstanding);
    setReference("");
  };

  const submitPayment = () => {
    if (!paying) return;
    recordPayment.mutate(
      {
        direction: isPayable ? "OUTGOING" : "INCOMING",
        method: "BANK_TRANSFER",
        reference: reference || undefined,
        currencyCode: paying.currencyCode,
        amount,
        supplierId: isPayable
          ? (paying as SupplierInvoiceRow).supplier.id
          : undefined,
        accountId: !isPayable
          ? (paying as CustomerInvoiceRow).account.id
          : undefined,
        allocations: [
          isPayable
            ? { supplierInvoiceId: paying.id, amount }
            : { customerInvoiceId: paying.id, amount },
        ],
      },
      { onSuccess: () => setPaying(null) }
    );
  };

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          actions={
            <DataTransfer
              entity={isPayable ? "supplier-invoices" : "customer-invoices"}
            />
          }
          title={isPayable ? "Accounts payable" : "Accounts receivable"}
          subtitle={
            isPayable
              ? "Invoices your suppliers have sent you, and what is still to pay."
              : "Invoices you have sent customers, and what is still to collect."
          }
        />

        <ErrorBanner error={query.error} />

        <div className="grid-auto-fit gap-3">
          <StatCard
            label={isPayable ? "Still to pay" : "Still to collect"}
            value={
              unknown
                ? "—"
                : formatMoney(
                    totals.outstanding.toFixed(2),
                    totals.currencyCode
                  )
            }
            hint={
              totals.others.length > 0
                ? `${totals.shown} in ${totals.currencyCode}; also ${totals.others.join(", ")}`
                : `${rows.length} invoice(s) shown`
            }
            tone="info"
          />
          <StatCard
            label="Of that, overdue"
            value={
              unknown
                ? "—"
                : formatMoney(totals.overdue.toFixed(2), totals.currencyCode)
            }
            hint="Past the due date"
            tone={totals.overdue > 0 ? "critical" : "positive"}
          />
          <StatCard
            label={
              isPayable
                ? "Orders not yet invoiced"
                : "Deliveries not yet invoiced"
            }
            value={
              uninvoiced.isLoading || uninvoiced.error
                ? "—"
                : String(billable.length)
            }
            hint={
              isPayable ? "Received purchase orders" : "Shipped sales orders"
            }
            tone={billable.length > 0 ? "warning" : "neutral"}
          />
        </div>

        {billable.length > 0 && (
          <Panel
            flush
            title={isPayable ? "Waiting to be invoiced" : "Ready to invoice"}
            description={
              isPayable
                ? "Purchase orders that have been received but have no supplier invoice against them yet."
                : "Sales orders that have shipped but have not been billed yet."
            }
          >
            <SimpleTable
              isLoading={uninvoiced.isLoading}
              rows={billable}
              keyOf={row => row.id}
              empty={
                uninvoiced.error
                  ? "This list could not be loaded."
                  : "Everything has been invoiced."
              }
              columns={[
                {
                  header: isPayable ? "Purchase order" : "Sales order",
                  cell: row => row.number,
                },
                {
                  header: isPayable ? "Supplier" : "Customer",
                  cell: row => row.party,
                },
                {
                  header: "Order date",
                  cell: row => formatDate(row.orderDate),
                },
                {
                  header: "Value",
                  align: "right",
                  cell: row => formatMoney(row.value, row.currencyCode),
                },
                {
                  header: "",
                  align: "right",
                  cell: row => (
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        createPayable.isPending || createReceivable.isPending
                      }
                      onClick={() =>
                        isPayable
                          ? createPayable.mutate({ purchaseOrderId: row.id })
                          : createReceivable.mutate({ salesOrderId: row.id })
                      }
                    >
                      Raise invoice
                    </Button>
                  ),
                },
              ]}
            />
          </Panel>
        )}

        <Panel
          flush
          title={isPayable ? "Supplier invoices" : "Customer invoices"}
          description="Every invoice, with what is still outstanding on it."
          actions={
            <Button
              type="button"
              variant={overdueOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setOverdueOnly(v => !v)}
            >
              {overdueOnly ? "Showing overdue only" : "Show overdue only"}
            </Button>
          }
        >
          <SimpleTable
            isLoading={query.isLoading}
            rows={rows}
            keyOf={row => row.id}
            empty={
              query.error
                ? "These invoices could not be loaded."
                : overdueOnly
                  ? "Nothing is overdue."
                  : isPayable
                    ? "No supplier invoices yet."
                    : "No customer invoices yet."
            }
            columns={[
              { header: "Invoice", cell: row => row.invoiceNumber },
              {
                header: isPayable ? "Supplier" : "Customer",
                cell: row =>
                  isPayable
                    ? (row as SupplierInvoiceRow).supplier?.name
                    : (row as CustomerInvoiceRow).account?.name,
              },
              {
                header: "Reference",
                cell: row =>
                  (row as SupplierInvoiceRow).supplierRef ??
                  (row as SupplierInvoiceRow).purchaseOrder?.poNumber ??
                  (row as CustomerInvoiceRow).salesOrder?.orderNumber ??
                  "—",
              },
              {
                header: "Status",
                cell: row => (
                  <Tag tone={STATUS_TONE[row.status] ?? "neutral"}>
                    {row.status}
                  </Tag>
                ),
              },
              {
                header: "Due",
                cell: row => {
                  // The server reports days-past-due on every invoice. One that
                  // has been settled is not late, whatever its due date says.
                  const late =
                    row.ageing.days > 0 && Number(row.outstanding) > 0;
                  return (
                    <span className={late ? "text-primary" : undefined}>
                      {formatDate(row.dueDate)}
                      {late ? ` · ${row.ageing.days}d late` : ""}
                    </span>
                  );
                },
              },
              {
                header: "Total",
                align: "right",
                cell: row => formatMoney(row.totalAmount, row.currencyCode),
              },
              {
                header: "Outstanding",
                align: "right",
                cell: row => formatMoney(row.outstanding, row.currencyCode),
              },
              {
                header: "",
                align: "right",
                cell: row => {
                  if (isPayable && row.status === "AWAITING_APPROVAL") {
                    return (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={approvePayable.isPending}
                        onClick={() => approvePayable.mutate(row.id)}
                      >
                        Approve
                      </Button>
                    );
                  }
                  if (Number(row.outstanding) <= 0) return null;
                  return (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openPayment(row)}
                    >
                      {isPayable ? "Pay" : "Receive"}
                    </Button>
                  );
                },
              },
            ]}
          />
        </Panel>

        {paying && (
          <Panel
            title={isPayable ? "Record a payment" : "Record a receipt"}
            description={
              isPayable
                ? "Money leaving the business to settle this invoice."
                : "Money arriving from the customer against this invoice."
            }
          >
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface-secondary p-3 text-sm">
                <span className="font-medium text-foreground">
                  {paying.invoiceNumber}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {formatMoney(paying.outstanding, paying.currencyCode)}{" "}
                  outstanding of{" "}
                  {formatMoney(paying.totalAmount, paying.currencyCode)}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Amount">
                  <Input
                    inputMode="decimal"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                </Field>
                <Field
                  label="Reference"
                  hint="UTR, cheque number, or transaction id"
                >
                  <Input
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                  />
                </Field>
                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    disabled={recordPayment.isPending || !amount}
                    onClick={submitPayment}
                  >
                    {recordPayment.isPending ? "Recording…" : "Record"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPaying(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Paying more than is outstanding is rejected — the balance on an
                invoice always matches the payments applied to it.
              </p>
            </div>
          </Panel>
        )}
      </PageShell>
    </ProtectedRoute>
  );
}
