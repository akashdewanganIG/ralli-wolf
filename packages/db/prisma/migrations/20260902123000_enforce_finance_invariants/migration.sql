

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "supplier_invoices"
    WHERE "purchase_order_id" IS NOT NULL
    GROUP BY "purchase_order_id" HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM "supplier_invoices"
    WHERE "grn_id" IS NOT NULL
    GROUP BY "grn_id" HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM "customer_invoices"
    WHERE "sales_order_id" IS NOT NULL
    GROUP BY "sales_order_id" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot enforce one invoice per source document: duplicate document links exist',
      HINT = 'Reconcile invoices sharing a purchase order, goods receipt, or sales order, then retry.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "supplier_invoices"
    WHERE "supplier_ref" IS NOT NULL
    GROUP BY "supplier_id", "supplier_ref" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot enforce supplier reference uniqueness: duplicate supplier invoice references exist',
      HINT = 'Reconcile duplicate supplier/reference pairs, then retry.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "supplier_invoices"
    WHERE "subtotal" < 0 OR "tax_amount" < 0 OR "total_amount" <= 0
       OR "total_amount" <> "subtotal" + "tax_amount"
       OR "amount_paid" < 0 OR "amount_paid" > "total_amount"
       OR "due_date" < "invoice_date"
  ) OR EXISTS (
    SELECT 1 FROM "customer_invoices"
    WHERE "subtotal" < 0 OR "tax_amount" < 0 OR "total_amount" <= 0
       OR "total_amount" <> "subtotal" + "tax_amount"
       OR "amount_paid" < 0 OR "amount_paid" > "total_amount"
       OR "due_date" < "invoice_date"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot enforce invoice checks: invalid totals, paid balances, or dates exist',
      HINT = 'Reconcile invoice arithmetic and dates, then retry.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "payments"
    WHERE "amount" <= 0 OR "unallocated" < 0 OR "unallocated" > "amount"
       OR ("direction" = 'OUTGOING' AND ("supplier_id" IS NULL OR "account_id" IS NOT NULL))
       OR ("direction" = 'INCOMING' AND ("account_id" IS NULL OR "supplier_id" IS NOT NULL))
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot enforce payment checks: invalid amounts or counterparty direction exist',
      HINT = 'Correct payment amount/unallocated values and assign the proper single counterparty, then retry.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "payment_allocations"
    WHERE "amount" <= 0
       OR (("supplier_invoice_id" IS NULL) = ("customer_invoice_id" IS NULL))
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot enforce allocation checks: invalid amounts or invoice targets exist',
      HINT = 'Each allocation must have a positive amount and exactly one invoice target.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "payment_allocations"
    WHERE "supplier_invoice_id" IS NOT NULL
    GROUP BY "payment_id", "supplier_invoice_id" HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM "payment_allocations"
    WHERE "customer_invoice_id" IS NOT NULL
    GROUP BY "payment_id", "customer_invoice_id" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot enforce allocation uniqueness: a payment repeats an invoice target',
      HINT = 'Merge duplicate allocation rows for each payment/invoice pair, then retry.';
  END IF;
END
$$;

CREATE UNIQUE INDEX "supplier_invoices_purchase_order_id_key"
  ON "supplier_invoices"("purchase_order_id");
CREATE UNIQUE INDEX "supplier_invoices_grn_id_key"
  ON "supplier_invoices"("grn_id");
CREATE UNIQUE INDEX "supplier_invoices_supplier_id_supplier_ref_key"
  ON "supplier_invoices"("supplier_id", "supplier_ref");
CREATE UNIQUE INDEX "customer_invoices_sales_order_id_key"
  ON "customer_invoices"("sales_order_id");
CREATE UNIQUE INDEX "payment_allocations_payment_supplier_invoice_key"
  ON "payment_allocations"("payment_id", "supplier_invoice_id")
  WHERE "supplier_invoice_id" IS NOT NULL;
CREATE UNIQUE INDEX "payment_allocations_payment_customer_invoice_key"
  ON "payment_allocations"("payment_id", "customer_invoice_id")
  WHERE "customer_invoice_id" IS NOT NULL;

ALTER TABLE "supplier_invoices"
  ADD CONSTRAINT "supplier_invoices_amounts_check"
    CHECK ("subtotal" >= 0 AND "tax_amount" >= 0 AND "total_amount" > 0
      AND "total_amount" = "subtotal" + "tax_amount"
      AND "amount_paid" >= 0 AND "amount_paid" <= "total_amount"),
  ADD CONSTRAINT "supplier_invoices_dates_check"
    CHECK ("due_date" >= "invoice_date");

ALTER TABLE "customer_invoices"
  ADD CONSTRAINT "customer_invoices_amounts_check"
    CHECK ("subtotal" >= 0 AND "tax_amount" >= 0 AND "total_amount" > 0
      AND "total_amount" = "subtotal" + "tax_amount"
      AND "amount_paid" >= 0 AND "amount_paid" <= "total_amount"),
  ADD CONSTRAINT "customer_invoices_dates_check"
    CHECK ("due_date" >= "invoice_date");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amounts_check"
    CHECK ("amount" > 0 AND "unallocated" >= 0 AND "unallocated" <= "amount"),
  ADD CONSTRAINT "payments_counterparty_check"
    CHECK (
      ("direction" = 'OUTGOING' AND "supplier_id" IS NOT NULL AND "account_id" IS NULL)
      OR
      ("direction" = 'INCOMING' AND "account_id" IS NOT NULL AND "supplier_id" IS NULL)
    );

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "payment_allocations_invoice_check"
    CHECK (("supplier_invoice_id" IS NOT NULL) <> ("customer_invoice_id" IS NOT NULL));
