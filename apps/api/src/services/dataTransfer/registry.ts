import { prisma } from "@repo/db";

/**
 * Every dataset the workspace can hand out or take in, in one place.
 *
 * Export used to be three hard-coded branches inside the controller. Adding a
 * fourth meant editing a column map, a switch and a union type in three files,
 * so in practice nothing was ever added. Here an entity is *data*: a label, a
 * column list, and a function that fetches a page of rows. The controller
 * stays the same size whether there are three entities or fifty.
 *
 * `importable` is deliberately sparse. Master data — products, suppliers,
 * warehouses, people — can be loaded from a spreadsheet, because a row is the
 * whole record. Ledger data cannot: a stock movement has to go through the
 * stock service to keep balances and lots consistent, and a payment has to go
 * through the finance service to hold an invoice's balance. Letting a
 * spreadsheet write those rows directly would walk straight past the advisory
 * locks and recomputation that keep them correct, so those entities export
 * only.
 */

export type TransferValue = string | number;
export type TransferRow = Record<string, TransferValue>;

export type TransferColumn = {
  header: string;
  key: string;
  /** Force Excel to treat the column as text — phone numbers, codes, pincodes. */
  text?: boolean;
};

export type TransferEntity = {
  /** URL segment and file-name stem. */
  key: string;
  /** Shown in the picker and used as the sheet name. */
  label: string;
  /** Which part of the product it belongs to, for grouping in the UI. */
  group:
    | "Marketing & sales"
    | "Supply chain"
    | "Inventory"
    | "Purchasing"
    | "Production"
    | "Finance"
    | "Administration";
  columns: TransferColumn[];
  fetch: (skip: number, take: number) => Promise<TransferRow[]>;
  /** Set when a spreadsheet row can safely become a record. */
  importable?: {
    /** Columns a row must carry to be accepted. */
    required: string[];
    /** Column used to detect an existing record, so re-import updates it. */
    uniqueBy: string;
    /** Turns one validated row into a create/update. Returns what happened. */
    apply: (row: Record<string, string>) => Promise<"created" | "updated">;
  };
};

const str = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v);
const num = (v: unknown): number =>
  v === null || v === undefined ? 0 : Number(v);
const date = (v: Date | null | undefined): string =>
  v ? v.toISOString().slice(0, 10) : "";

/**
 * A spreadsheet cell that has to land on an enum.
 *
 * People type "assembly line" where the database wants ASSEMBLY_LINE, so the
 * value is normalised before it is checked; anything still unrecognised falls
 * back rather than failing the row over a label.
 */
function enumOr(
  value: string | undefined,
  allowed: string[],
  fallback: string
) {
  const normalised = value
    ?.trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return normalised && allowed.includes(normalised) ? normalised : fallback;
}

/** A whole number from a cell, or the default when it is blank or nonsense. */
function intOr(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

/** A decimal string for Prisma, kept as text so nothing is lost on the way. */
function decOr(value: string | undefined, fallback: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : fallback;
}

/** Trim and drop empty strings, so a blank cell means "not provided". */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The registry.
 *
 * Order matters only for how the picker reads; grouping does the rest.
 */
export const TRANSFER_ENTITIES: TransferEntity[] = [
  // ------------------------------------------------ marketing and sales ---
  {
    key: "leads",
    label: "Leads",
    group: "Marketing & sales",
    columns: [
      { header: "ID", key: "id" },
      { header: "First Name", key: "firstName" },
      { header: "Last Name", key: "lastName" },
      { header: "Email", key: "email" },
      { header: "Phone", key: "phone", text: true },
      { header: "Company Name", key: "companyName" },
      { header: "City", key: "city" },
      { header: "State", key: "state" },
      { header: "Pincode", key: "pincode", text: true },
      { header: "Source", key: "source" },
      { header: "Status", key: "status" },
      { header: "Created At", key: "createdAt" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.lead.findMany({
        skip,
        take,
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(r => ({
        id: r.id,
        firstName: str(r.firstName),
        lastName: str(r.lastName),
        email: str(r.email),
        phone: str(r.phone),
        companyName: str(r.companyName),
        city: str(r.city),
        state: str(r.state),
        pincode: str(r.pincode),
        source: str(r.source),
        status: str(r.status),
        createdAt: date(r.createdAt),
      }));
    },
    importable: {
      required: ["firstName", "email"],
      uniqueBy: "email",
      apply: async row => {
        const email = row.email!.trim().toLowerCase();
        const existing = await prisma.lead.findFirst({
          where: { email, deletedAt: null },
          select: { id: true },
        });
        const data = {
          firstName: row.firstName!.trim(),
          lastName: clean(row.lastName),
          phone: clean(row.phone),
          companyName: clean(row.companyName),
          city: clean(row.city),
          state: clean(row.state),
          pincode: clean(row.pincode),
          // `source` is an enum, so a spreadsheet cannot invent one. A row
          // loaded from a file is by definition an import.
          source: "IMPORT" as const,
        };
        if (existing) {
          await prisma.lead.update({ where: { id: existing.id }, data });
          return "updated";
        }
        await prisma.lead.create({ data: { ...data, email } });
        return "created";
      },
    },
  },
  {
    key: "contacts",
    label: "Contacts",
    group: "Marketing & sales",
    columns: [
      { header: "ID", key: "id" },
      { header: "Name", key: "name" },
      { header: "Email", key: "email" },
      { header: "Phone", key: "phone", text: true },
      { header: "Position", key: "position" },
      { header: "Account", key: "accountName" },
      { header: "Created At", key: "createdAt" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.contact.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { account: { select: { name: true } } },
      });
      return rows.map(r => ({
        id: r.id,
        name: str(r.name),
        email: str(r.email),
        phone: str(r.phone),
        position: str(r.position),
        accountName: str(r.account?.name),
        createdAt: date(r.createdAt),
      }));
    },
  },
  {
    key: "accounts",
    label: "Accounts",
    group: "Marketing & sales",
    columns: [
      { header: "ID", key: "id" },
      { header: "Name", key: "name" },
      { header: "Industry", key: "industry" },
      { header: "Website", key: "website" },
      { header: "Created At", key: "createdAt" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.account.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
      });
      return rows.map(r => ({
        id: r.id,
        name: str(r.name),
        industry: str(r.industry),
        website: str(r.website),
        createdAt: date(r.createdAt),
      }));
    },
    importable: {
      required: ["name"],
      uniqueBy: "name",
      apply: async row => {
        const name = row.name!.trim();
        const existing = await prisma.account.findFirst({
          where: { name },
          select: { id: true },
        });
        const data = {
          industry: clean(row.industry),
          website: clean(row.website),
        };
        if (existing) {
          await prisma.account.update({ where: { id: existing.id }, data });
          return "updated";
        }
        await prisma.account.create({ data: { ...data, name } });
        return "created";
      },
    },
  },
  {
    key: "opportunities",
    label: "Opportunities",
    group: "Marketing & sales",
    columns: [
      { header: "ID", key: "id" },
      { header: "Name", key: "name" },
      { header: "Account", key: "accountName" },
      { header: "Stage", key: "stage" },
      { header: "Amount", key: "amount" },
      { header: "Probability %", key: "probability" },
      { header: "Close Date", key: "closeDate" },
      { header: "Owner", key: "owner" },
      { header: "Created At", key: "createdAt" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.opportunity.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          account: { select: { name: true } },
          owner: { select: { firstName: true, lastName: true } },
        },
      });
      return rows.map(r => ({
        id: r.id,
        name: str(r.name),
        accountName: str(r.account?.name),
        stage: str(r.stage),
        amount: num(r.amount),
        probability: num(r.probability),
        closeDate: date(r.expectedCloseDate),
        owner: `${str(r.owner?.firstName)} ${str(r.owner?.lastName)}`.trim(),
        createdAt: date(r.createdAt),
      }));
    },
  },
  {
    key: "quotes",
    label: "Quotes",
    group: "Marketing & sales",
    columns: [
      { header: "ID", key: "id" },
      { header: "Quote Number", key: "quoteNumber", text: true },
      { header: "Account", key: "accountName" },
      { header: "Status", key: "status" },
      { header: "Subtotal", key: "subtotal" },
      { header: "Tax", key: "taxAmount" },
      { header: "Grand Total", key: "grandTotal" },
      { header: "Valid Until", key: "validUntil" },
      { header: "Created At", key: "createdAt" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.quote.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { account: { select: { name: true } } },
      });
      return rows.map(r => ({
        id: r.id,
        quoteNumber: str(r.quoteNumber),
        accountName: str(r.account?.name),
        status: str(r.status),
        subtotal: num(r.subtotal),
        taxAmount: num(r.taxAmount),
        grandTotal: num(r.grandTotal),
        validUntil: date(r.validUntil),
        createdAt: date(r.createdAt),
      }));
    },
  },
  {
    key: "sales-orders",
    label: "Sales orders",
    group: "Marketing & sales",
    columns: [
      { header: "ID", key: "id" },
      { header: "Order Number", key: "orderNumber", text: true },
      { header: "Account", key: "accountName" },
      { header: "Status", key: "status" },
      { header: "Order Date", key: "orderDate" },
      { header: "Subtotal", key: "subtotal" },
      { header: "Tax", key: "taxAmount" },
      { header: "Grand Total", key: "grandTotal" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.salesOrder.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
        include: { account: { select: { name: true } } },
      });
      return rows.map(r => ({
        id: r.id,
        orderNumber: str(r.orderNumber),
        accountName: str(r.account?.name),
        status: str(r.status),
        orderDate: date(r.orderDate),
        subtotal: num(r.subtotal),
        taxAmount: num(r.taxAmount),
        grandTotal: num(r.grandTotal),
      }));
    },
  },
  {
    key: "products",
    label: "Products",
    group: "Marketing & sales",
    columns: [
      { header: "ID", key: "id" },
      { header: "Code", key: "code", text: true },
      { header: "Name", key: "name" },
      { header: "HSN Code", key: "hsnCode", text: true },
      { header: "Category", key: "category" },
      { header: "Unit", key: "unit" },
      { header: "Standard Cost", key: "standardCost" },
      { header: "Active", key: "isActive" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.product.findMany({
        skip,
        take,
        orderBy: { id: "asc" },
        include: {
          category: { select: { name: true } },
          uom: { select: { code: true } },
        },
      });
      return rows.map(r => ({
        id: r.id,
        code: str(r.code),
        name: str(r.name),
        hsnCode: str(r.hsnCode),
        category: str(r.category?.name),
        unit: str(r.uom?.code),
        standardCost: num(r.standardCost),
        isActive: r.active ? "Yes" : "No",
      }));
    },
  },
  {
    key: "price-books",
    label: "Price books",
    group: "Marketing & sales",
    columns: [
      { header: "ID", key: "id" },
      { header: "Name", key: "name" },
      { header: "Currency", key: "currency" },
      { header: "Description", key: "description" },
      { header: "Active", key: "isActive" },
      { header: "Entries", key: "entries" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.priceBook.findMany({
        skip,
        take,
        orderBy: { id: "asc" },
        include: { _count: { select: { priceBookEntries: true } } },
      });
      return rows.map(r => ({
        id: r.id,
        name: str(r.name),
        currency: str(r.currencyCode),
        description: str(r.description),
        isActive: r.isActive ? "Yes" : "No",
        entries: r._count.priceBookEntries,
      }));
    },
  },

  // ------------------------------------------------------- supply chain ---
  {
    key: "warehouses",
    label: "Warehouses",
    group: "Supply chain",
    columns: [
      { header: "ID", key: "id" },
      { header: "Code", key: "code", text: true },
      { header: "Name", key: "name" },
      { header: "Type", key: "type" },
      { header: "City", key: "city" },
      { header: "State", key: "state" },
      { header: "Active", key: "isActive" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.warehouse.findMany({
        skip,
        take,
        orderBy: { id: "asc" },
      });
      return rows.map(r => ({
        id: r.id,
        code: str(r.code),
        name: str(r.name),
        type: str(r.type),
        city: str(r.city),
        state: str(r.state),
        isActive: r.isActive ? "Yes" : "No",
      }));
    },
    importable: {
      required: ["code", "name"],
      uniqueBy: "code",
      apply: async row => {
        const code = row.code!.trim().toUpperCase();
        const existing = await prisma.warehouse.findUnique({
          where: { code },
          select: { id: true },
        });
        const type = enumOr(
          row.type,
          ["WAREHOUSE", "PLANT", "STORE", "TRANSIT", "VIRTUAL"],
          "WAREHOUSE"
        ) as "WAREHOUSE" | "PLANT" | "STORE" | "TRANSIT" | "VIRTUAL";
        const data = {
          name: row.name!.trim(),
          type,
          city: clean(row.city),
          state: clean(row.state),
        };
        if (existing) {
          await prisma.warehouse.update({ where: { id: existing.id }, data });
          return "updated";
        }
        await prisma.warehouse.create({ data: { ...data, code } });
        return "created";
      },
    },
  },
  {
    key: "suppliers",
    label: "Suppliers",
    group: "Purchasing",
    columns: [
      { header: "ID", key: "id" },
      { header: "Code", key: "code", text: true },
      { header: "Name", key: "name" },
      { header: "Email", key: "email" },
      { header: "Phone", key: "phone", text: true },
      { header: "City", key: "city" },
      { header: "Payment Terms", key: "paymentTerms" },
      { header: "Lead Time (days)", key: "leadTimeDays" },
      { header: "Status", key: "status" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.supplier.findMany({
        skip,
        take,
        orderBy: { id: "asc" },
      });
      return rows.map(r => ({
        id: r.id,
        code: str(r.code),
        name: str(r.name),
        email: str(r.email),
        phone: str(r.phone),
        city: str(r.city),
        paymentTerms: str(r.paymentTerms),
        leadTimeDays: num(r.leadTimeDays),
        status: str(r.status),
      }));
    },
    importable: {
      required: ["code", "name"],
      uniqueBy: "code",
      apply: async row => {
        const code = row.code!.trim().toUpperCase();
        const existing = await prisma.supplier.findUnique({
          where: { code },
          select: { id: true },
        });
        const leadTime = Number(row.leadTimeDays);
        const data = {
          name: row.name!.trim(),
          email: clean(row.email),
          phone: clean(row.phone),
          city: clean(row.city),
          paymentTerms: clean(row.paymentTerms),
          ...(Number.isFinite(leadTime) && leadTime > 0
            ? { leadTimeDays: Math.round(leadTime) }
            : {}),
        };
        if (existing) {
          await prisma.supplier.update({ where: { id: existing.id }, data });
          return "updated";
        }
        await prisma.supplier.create({ data: { ...data, code } });
        return "created";
      },
    },
  },
  {
    key: "purchase-requisitions",
    label: "Purchase requisitions",
    group: "Purchasing",
    columns: [
      { header: "ID", key: "id" },
      { header: "Number", key: "requisitionNumber", text: true },
      { header: "Status", key: "status" },
      { header: "Warehouse", key: "warehouse" },
      { header: "Required By", key: "requiredBy" },
      { header: "Created At", key: "createdAt" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.purchaseRequisition.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
        include: { warehouse: { select: { code: true } } },
      });
      return rows.map(r => ({
        id: r.id,
        requisitionNumber: str(r.requisitionNumber),
        status: str(r.status),
        warehouse: str(r.warehouse?.code),
        requiredBy: date(r.requiredByDate),
        createdAt: date(r.createdAt),
      }));
    },
  },
  {
    key: "purchase-orders",
    label: "Purchase orders",
    group: "Purchasing",
    columns: [
      { header: "ID", key: "id" },
      { header: "PO Number", key: "poNumber", text: true },
      { header: "Supplier", key: "supplier" },
      { header: "Status", key: "status" },
      { header: "Currency", key: "currencyCode" },
      { header: "Order Date", key: "orderDate" },
      { header: "Expected", key: "expectedDate" },
      { header: "Subtotal", key: "subtotal" },
      { header: "Tax", key: "taxAmount" },
      { header: "Grand Total", key: "grandTotal" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.purchaseOrder.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
        include: { supplier: { select: { name: true } } },
      });
      return rows.map(r => ({
        id: r.id,
        poNumber: str(r.poNumber),
        supplier: str(r.supplier?.name),
        status: str(r.status),
        currencyCode: str(r.currencyCode),
        orderDate: date(r.orderDate),
        expectedDate: date(r.expectedDeliveryDate),
        subtotal: num(r.subtotal),
        taxAmount: num(r.taxAmount),
        grandTotal: num(r.grandTotal),
      }));
    },
  },
  {
    key: "goods-receipts",
    label: "Goods receipts",
    group: "Purchasing",
    columns: [
      { header: "ID", key: "id" },
      { header: "GRN Number", key: "grnNumber", text: true },
      { header: "Supplier", key: "supplier" },
      { header: "Warehouse", key: "warehouse" },
      { header: "Status", key: "status" },
      { header: "Received On", key: "receivedDate" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.goodsReceiptNote.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
        include: {
          supplier: { select: { name: true } },
          warehouse: { select: { code: true } },
        },
      });
      return rows.map(r => ({
        id: r.id,
        grnNumber: str(r.grnNumber),
        supplier: str(r.supplier?.name),
        warehouse: str(r.warehouse?.code),
        status: str(r.status),
        receivedDate: date(r.receivedDate),
      }));
    },
  },
  {
    key: "quality-checks",
    label: "Quality checks",
    group: "Purchasing",
    columns: [
      { header: "ID", key: "id" },
      { header: "QC Number", key: "qcNumber", text: true },
      { header: "Result", key: "result" },
      { header: "Accepted", key: "accepted" },
      { header: "Rejected", key: "rejected" },
      { header: "Checked On", key: "checkedAt" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.qualityCheck.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
      });
      return rows.map(r => ({
        id: r.id,
        qcNumber: str(r.qcNumber),
        result: str(r.result),
        accepted: num(r.acceptedQuantity),
        rejected: num(r.rejectedQuantity),
        checkedAt: date(r.inspectedAt),
      }));
    },
  },

  // ---------------------------------------------------------- inventory ---
  {
    key: "stock-positions",
    label: "Stock positions",
    group: "Inventory",
    columns: [
      { header: "Product Code", key: "productCode", text: true },
      { header: "Product", key: "product" },
      { header: "Warehouse", key: "warehouse" },
      { header: "Bin", key: "bin", text: true },
      { header: "Lot", key: "lot", text: true },
      { header: "On Hand", key: "quantity" },
      { header: "Reserved", key: "reserved" },
      { header: "Available", key: "available" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.stockBalance.findMany({
        skip,
        take,
        orderBy: { id: "asc" },
        include: {
          product: { select: { code: true, name: true } },
          warehouse: { select: { code: true } },
          bin: { select: { code: true } },
          lot: { select: { lotNumber: true } },
        },
      });
      return rows.map(r => ({
        productCode: str(r.product?.code),
        product: str(r.product?.name),
        warehouse: str(r.warehouse?.code),
        bin: str(r.bin?.code),
        lot: str(r.lot?.lotNumber),
        quantity: num(r.quantity),
        reserved: num(r.reservedQuantity),
        available: num(r.quantity) - num(r.reservedQuantity),
      }));
    },
  },
  {
    key: "stock-movements",
    label: "Stock ledger",
    group: "Inventory",
    columns: [
      { header: "Movement", key: "movementNumber", text: true },
      { header: "Type", key: "movementType" },
      { header: "Product Code", key: "productCode", text: true },
      { header: "Product", key: "product" },
      { header: "Quantity", key: "quantity" },
      { header: "Unit Cost", key: "unitCost" },
      { header: "Value", key: "value" },
      { header: "Reference", key: "reference" },
      { header: "Occurred At", key: "occurredAt" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.stockMovement.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
        include: { product: { select: { code: true, name: true } } },
      });
      return rows.map(r => ({
        movementNumber: str(r.movementNumber),
        movementType: str(r.movementType),
        productCode: str(r.product?.code),
        product: str(r.product?.name),
        quantity: num(r.quantity),
        unitCost: num(r.unitCost),
        value: num(r.quantity) * num(r.unitCost),
        reference: str(r.referenceNumber),
        occurredAt: date(r.occurredAt),
      }));
    },
  },
  {
    key: "stock-counts",
    label: "Stock counts",
    group: "Inventory",
    columns: [
      { header: "Count", key: "countNumber", text: true },
      { header: "Warehouse", key: "warehouse" },
      { header: "Status", key: "status" },
      { header: "Scheduled", key: "scheduledDate" },
      { header: "Lines", key: "lines" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.stockCount.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
        include: {
          warehouse: { select: { code: true } },
          _count: { select: { lines: true } },
        },
      });
      return rows.map(r => ({
        countNumber: str(r.countNumber),
        warehouse: str(r.warehouse?.code),
        status: str(r.status),
        scheduledDate: date(r.scheduledDate),
        lines: r._count.lines,
      }));
    },
  },
  {
    key: "reorder-rules",
    label: "Reorder policies",
    group: "Inventory",
    columns: [
      { header: "Product Code", key: "productCode", text: true },
      { header: "Product", key: "product" },
      { header: "Warehouse", key: "warehouse" },
      { header: "Safety Stock", key: "safetyStock" },
      { header: "Reorder Point", key: "reorderPoint" },
      { header: "Reorder Qty", key: "reorderQuantity" },
      { header: "Maximum", key: "maximumStock" },
      { header: "Auto Requisition", key: "autoRequisition" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.reorderRule.findMany({
        skip,
        take,
        orderBy: { id: "asc" },
        include: {
          product: { select: { code: true, name: true } },
          warehouse: { select: { code: true } },
        },
      });
      return rows.map(r => ({
        productCode: str(r.product?.code),
        product: str(r.product?.name),
        warehouse: str(r.warehouse?.code),
        safetyStock: num(r.safetyStock),
        reorderPoint: num(r.reorderPoint),
        reorderQuantity: num(r.reorderQuantity),
        maximumStock: num(r.maximumStock),
        autoRequisition: r.autoRequisition ? "Yes" : "No",
      }));
    },
  },
  {
    key: "stock-alerts",
    label: "Stock alerts",
    group: "Inventory",
    columns: [
      { header: "Product Code", key: "productCode", text: true },
      { header: "Product", key: "product" },
      { header: "Warehouse", key: "warehouse" },
      { header: "Type", key: "alertType" },
      { header: "Severity", key: "severity" },
      { header: "Status", key: "status" },
      { header: "Raised At", key: "createdAt" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.stockAlert.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
        include: {
          product: { select: { code: true, name: true } },
          warehouse: { select: { code: true } },
        },
      });
      return rows.map(r => ({
        productCode: str(r.product?.code),
        product: str(r.product?.name),
        warehouse: str(r.warehouse?.code),
        alertType: str(r.alertType),
        severity: str(r.severity),
        status: str(r.status),
        createdAt: date(r.createdAt),
      }));
    },
  },
  {
    key: "stock-lots",
    label: "Stock lots",
    group: "Inventory",
    columns: [
      { header: "Lot", key: "lotNumber", text: true },
      { header: "Product Code", key: "productCode", text: true },
      { header: "Product", key: "product" },
      { header: "Warehouse", key: "warehouse" },
      { header: "Quantity", key: "quantity" },
      { header: "Unit Cost", key: "unitCost" },
      { header: "Expiry", key: "expiryDate" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.stockLot.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
        include: {
          product: { select: { code: true, name: true } },
          originWarehouse: { select: { code: true } },
        },
      });
      return rows.map(r => ({
        lotNumber: str(r.lotNumber),
        productCode: str(r.product?.code),
        product: str(r.product?.name),
        warehouse: str(r.originWarehouse?.code),
        quantity: num(r.remainingQuantity),
        unitCost: num(r.unitCost),
        expiryDate: date(r.expiryDate),
      }));
    },
  },

  // --------------------------------------------------------- production ---
  {
    key: "boms",
    label: "Bills of materials",
    group: "Production",
    columns: [
      { header: "BOM", key: "bomNumber", text: true },
      { header: "Product Code", key: "productCode", text: true },
      { header: "Product", key: "product" },
      { header: "Version", key: "version" },
      { header: "Status", key: "status" },
      { header: "Components", key: "components" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.billOfMaterials.findMany({
        skip,
        take,
        orderBy: { id: "asc" },
        include: {
          product: { select: { code: true, name: true } },
          _count: { select: { components: true } },
        },
      });
      return rows.map(r => ({
        bomNumber: str(r.bomNumber),
        productCode: str(r.product?.code),
        product: str(r.product?.name),
        version: str(r.version),
        status: str(r.status),
        components: r._count.components,
      }));
    },
  },
  {
    key: "production-orders",
    label: "Production orders",
    group: "Production",
    columns: [
      { header: "Order", key: "orderNumber", text: true },
      { header: "Product Code", key: "productCode", text: true },
      { header: "Product", key: "product" },
      { header: "Warehouse", key: "warehouse" },
      { header: "Status", key: "status" },
      { header: "Planned Qty", key: "plannedQuantity" },
      { header: "Produced Qty", key: "producedQuantity" },
      { header: "Start", key: "plannedStartDate" },
      { header: "End", key: "plannedEndDate" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.productionOrder.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
        include: {
          product: { select: { code: true, name: true } },
          warehouse: { select: { code: true } },
        },
      });
      return rows.map(r => ({
        orderNumber: str(r.orderNumber),
        productCode: str(r.product?.code),
        product: str(r.product?.name),
        warehouse: str(r.warehouse?.code),
        status: str(r.status),
        plannedQuantity: num(r.plannedQuantity),
        producedQuantity: num(r.producedQuantity),
        plannedStartDate: date(r.plannedStartDate),
        plannedEndDate: date(r.plannedEndDate),
      }));
    },
  },
  {
    key: "work-centers",
    label: "Work centres",
    group: "Production",
    columns: [
      { header: "Code", key: "code", text: true },
      { header: "Name", key: "name" },
      { header: "Type", key: "type" },
      { header: "Warehouse", key: "warehouse" },
      { header: "Minutes/Day", key: "capacityMinutesPerDay" },
      { header: "Efficiency %", key: "efficiencyPercent" },
      { header: "Parallel", key: "parallelCapacity" },
      { header: "Cost/Hour", key: "costPerHour" },
      { header: "Active", key: "isActive" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.workCenter.findMany({
        skip,
        take,
        orderBy: { id: "asc" },
        include: { warehouse: { select: { code: true } } },
      });
      return rows.map(r => ({
        code: str(r.code),
        name: str(r.name),
        type: str(r.type),
        warehouse: str(r.warehouse?.code),
        capacityMinutesPerDay: num(r.capacityMinutesPerDay),
        efficiencyPercent: num(r.efficiencyPercent),
        parallelCapacity: num(r.parallelCapacity),
        costPerHour: num(r.costPerHour),
        isActive: r.isActive ? "Yes" : "No",
      }));
    },
    importable: {
      required: ["code", "name", "warehouse"],
      uniqueBy: "code",
      apply: async row => {
        const code = row.code!.trim().toUpperCase();
        const warehouse = await prisma.warehouse.findUnique({
          where: { code: row.warehouse!.trim().toUpperCase() },
          select: { id: true },
        });
        if (!warehouse) {
          throw new Error(
            `No warehouse with code "${row.warehouse}". Import warehouses first.`
          );
        }
        const type = enumOr(
          row.type,
          ["MACHINE", "ASSEMBLY_LINE", "WORKSTATION", "INSPECTION", "PACKING"],
          "MACHINE"
        ) as
          | "MACHINE"
          | "ASSEMBLY_LINE"
          | "WORKSTATION"
          | "INSPECTION"
          | "PACKING";
        const data = {
          name: row.name!.trim(),
          type,
          warehouseId: warehouse.id,
          capacityMinutesPerDay: intOr(row.capacityMinutesPerDay, 480),
          efficiencyPercent: decOr(row.efficiencyPercent, "100"),
          costPerHour: decOr(row.costPerHour, "0"),
          parallelCapacity: intOr(row.parallelCapacity, 1),
        };
        const existing = await prisma.workCenter.findUnique({
          where: { code },
          select: { id: true },
        });
        if (existing) {
          await prisma.workCenter.update({ where: { id: existing.id }, data });
          return "updated";
        }
        await prisma.workCenter.create({ data: { ...data, code } });
        return "created";
      },
    },
  },
  {
    key: "material-requisitions",
    label: "Material requisitions",
    group: "Production",
    columns: [
      { header: "Number", key: "requisitionNumber", text: true },
      { header: "Status", key: "status" },
      { header: "Warehouse", key: "warehouse" },
      { header: "Required By", key: "requiredBy" },
      { header: "Created At", key: "createdAt" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.materialRequisition.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
        include: { warehouse: { select: { code: true } } },
      });
      return rows.map(r => ({
        requisitionNumber: str(r.requisitionNumber),
        status: str(r.status),
        warehouse: str(r.warehouse?.code),
        requiredBy: date(r.requiredByDate),
        createdAt: date(r.createdAt),
      }));
    },
  },

  // ------------------------------------------------------------ finance ---
  {
    key: "supplier-invoices",
    label: "Supplier invoices",
    group: "Finance",
    columns: [
      { header: "Invoice", key: "invoiceNumber", text: true },
      { header: "Supplier", key: "supplier" },
      { header: "Supplier Ref", key: "supplierRef", text: true },
      { header: "Status", key: "status" },
      { header: "Currency", key: "currencyCode" },
      { header: "Invoice Date", key: "invoiceDate" },
      { header: "Due Date", key: "dueDate" },
      { header: "Total", key: "totalAmount" },
      { header: "Paid", key: "amountPaid" },
      { header: "Outstanding", key: "outstanding" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.supplierInvoice.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
        include: { supplier: { select: { name: true } } },
      });
      return rows.map(r => ({
        invoiceNumber: str(r.invoiceNumber),
        supplier: str(r.supplier?.name),
        supplierRef: str(r.supplierRef),
        status: str(r.status),
        currencyCode: str(r.currencyCode),
        invoiceDate: date(r.invoiceDate),
        dueDate: date(r.dueDate),
        totalAmount: num(r.totalAmount),
        amountPaid: num(r.amountPaid),
        outstanding: num(r.totalAmount) - num(r.amountPaid),
      }));
    },
  },
  {
    key: "customer-invoices",
    label: "Customer invoices",
    group: "Finance",
    columns: [
      { header: "Invoice", key: "invoiceNumber", text: true },
      { header: "Customer", key: "account" },
      { header: "Status", key: "status" },
      { header: "Currency", key: "currencyCode" },
      { header: "Invoice Date", key: "invoiceDate" },
      { header: "Due Date", key: "dueDate" },
      { header: "Total", key: "totalAmount" },
      { header: "Paid", key: "amountPaid" },
      { header: "Outstanding", key: "outstanding" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.customerInvoice.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
        include: { account: { select: { name: true } } },
      });
      return rows.map(r => ({
        invoiceNumber: str(r.invoiceNumber),
        account: str(r.account?.name),
        status: str(r.status),
        currencyCode: str(r.currencyCode),
        invoiceDate: date(r.invoiceDate),
        dueDate: date(r.dueDate),
        totalAmount: num(r.totalAmount),
        amountPaid: num(r.amountPaid),
        outstanding: num(r.totalAmount) - num(r.amountPaid),
      }));
    },
  },
  {
    key: "payments",
    label: "Payments",
    group: "Finance",
    columns: [
      { header: "Payment", key: "paymentNumber", text: true },
      { header: "Direction", key: "direction" },
      { header: "Method", key: "method" },
      { header: "Party", key: "party" },
      { header: "Reference", key: "reference", text: true },
      { header: "Currency", key: "currencyCode" },
      { header: "Amount", key: "amount" },
      { header: "Paid On", key: "paymentDate" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.payment.findMany({
        skip,
        take,
        orderBy: { id: "desc" },
        include: {
          supplier: { select: { name: true } },
          account: { select: { name: true } },
        },
      });
      return rows.map(r => ({
        paymentNumber: str(r.paymentNumber),
        direction: str(r.direction),
        method: str(r.method),
        party: str(r.supplier?.name || r.account?.name),
        reference: str(r.reference),
        currencyCode: str(r.currencyCode),
        amount: num(r.amount),
        paymentDate: date(r.paymentDate),
      }));
    },
  },

  // ----------------------------------------------------- administration ---
  {
    key: "users",
    label: "Users",
    group: "Administration",
    columns: [
      { header: "ID", key: "id" },
      { header: "Email", key: "email" },
      { header: "First Name", key: "firstName" },
      { header: "Last Name", key: "lastName" },
      { header: "Role", key: "role" },
      { header: "Created At", key: "createdAt" },
    ],
    fetch: async (skip, take) => {
      const rows = await prisma.user.findMany({
        skip,
        take,
        orderBy: { id: "asc" },
        // Never widen this to the whole row: it carries passwordHash and
        // totpSecret, and an export is a file that leaves the building.
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      });
      return rows.map(r => ({
        id: r.id,
        email: str(r.email),
        firstName: str(r.firstName),
        lastName: str(r.lastName),
        role: str(r.role),
        createdAt: date(r.createdAt),
      }));
    },
  },
];

const BY_KEY = new Map(TRANSFER_ENTITIES.map(e => [e.key, e]));

export function findEntity(key: string): TransferEntity | undefined {
  return BY_KEY.get(key);
}

/** What the UI needs to build its picker, without the server-side functions. */
export function entityCatalogue() {
  return TRANSFER_ENTITIES.map(e => ({
    key: e.key,
    label: e.label,
    group: e.group,
    columns: e.columns.map(c => c.header),
    importable: Boolean(e.importable),
    requiredColumns: e.importable?.required ?? [],
  }));
}
