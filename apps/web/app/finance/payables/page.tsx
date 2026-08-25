"use client";

import { InvoiceLedger } from "@/components/finance/invoice-ledger";

export default function PayablesPage() {
  return <InvoiceLedger side="PAYABLE" />;
}
