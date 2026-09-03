import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma, QuoteStatus, QuoteType } from "@prisma/client";
import {
  QuotePdfData,
  renderQuotePdf,
} from "../src/services/quote-pdf.service.js";

function quoteFixture(): QuotePdfData {
  const createdAt = new Date("2026-08-31T08:30:00.000Z");
  const approvedAt = new Date("2026-09-01T06:15:00.000Z");

  return {
    id: 42,
    quoteNumber: "QT-2026-0042",
    name: "Enterprise equipment quote",
    description: null,
    status: QuoteStatus.APPROVED,
    type: QuoteType.QUOTE,
    version: 2,
    isPrimary: true,
    subtotal: new Prisma.Decimal("1000.00"),
    discount: new Prisma.Decimal("50.00"),
    discountPercent: new Prisma.Decimal("5.00"),
    taxAmount: new Prisma.Decimal("171.00"),
    taxPercent: new Prisma.Decimal("18.00"),
    shippingAmount: new Prisma.Decimal("25.00"),
    grandTotal: new Prisma.Decimal("1146.00"),
    validUntil: new Date("2026-09-30T00:00:00.000Z"),
    approvedAt,
    rejectedAt: null,
    presentedAt: null,
    acceptedAt: null,
    billingName: "Acme Industries",
    billingStreet: "10 Industrial Estate",
    billingCity: "New Delhi",
    billingState: "Delhi",
    billingPostalCode: "110001",
    billingCountry: "India",
    shippingName: "Acme Factory",
    shippingStreet: "20 Factory Road",
    shippingCity: "Gurugram",
    shippingState: "Haryana",
    shippingPostalCode: "122001",
    shippingCountry: "India",
    paymentTerms: "Net 30",
    deliveryTerms: "FOB destination",
    notes: "Thank you for your business.",
    internalNotes: null,
    approvalComment: "Approved",
    rejectionComment: null,
    opportunityId: 8,
    accountId: 9,
    contactId: 10,
    preparedById: 11,
    approvedById: 12,
    rejectedById: null,
    createdAt,
    updatedAt: new Date("2026-09-01T06:15:00.000Z"),
    account: { id: 9, name: "Acme Industries" },
    contact: {
      id: 10,
      name: "Asha Kumar",
      email: "asha@example.com",
      phone: "+919876543210",
    },
    preparedBy: {
      id: 11,
      firstName: "Ravi",
      lastName: "Sharma",
      email: "ravi@example.com",
    },
    opportunity: {
      id: 8,
      name: "Factory expansion",
      opportunityNumber: "OPP-0008",
    },
    lineItems: [
      {
        id: 101,
        quoteId: 42,
        productId: 55,
        priceBookEntryId: 77,
        quantity: 2,
        listPrice: new Prisma.Decimal("500.00"),
        unitPrice: new Prisma.Decimal("500.00"),
        discount: new Prisma.Decimal("5.00"),
        totalPrice: new Prisma.Decimal("950.00"),
        description: null,
        sortOrder: 0,
        createdAt,
        updatedAt: createdAt,
        product: { id: 55, name: "Industrial drill", code: "DRILL-55" },
      },
    ],
  };
}

test("renderQuotePdf is byte-stable for identical persisted quote data", async () => {
  const quote = quoteFixture();

  const [first, second] = await Promise.all([
    renderQuotePdf(quote),
    renderQuotePdf(quote),
  ]);

  assert.equal(first.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.deepEqual(first, second);
});

test("renderQuotePdf output changes when customer-visible data changes", async () => {
  const original = quoteFixture();
  const changed = { ...quoteFixture(), name: "Revised equipment quote" };

  assert.notDeepEqual(
    await renderQuotePdf(original),
    await renderQuotePdf(changed)
  );
});
