import { prisma } from "@repo/db";
import {
  Prisma,
  GrnStatus,
  PurchaseOrderLineStatus,
  PurchaseOrderStatus,
  QcResult,
  StockMovementType,
} from "@prisma/client";
import { nextDocumentNumber, SEQUENCE_KEYS } from "./numbering.service.js";
import { receiveStock } from "./stock.service.js";
import { createPutawayTask } from "./wms.service.js";
import { DomainError, NotFoundError } from "./errors.js";
import {
  ZERO,
  requireNonNegative,
  requirePositive,
  roundCost,
  roundMoney,
  roundQuantity,
  toDecimal,
} from "./decimal.js";

type Tx = Prisma.TransactionClient;
type Client = Tx | typeof prisma;

export interface PurchaseLineInput {
  productId: number;
  quantity: Prisma.Decimal | number | string;
  unitPrice?: Prisma.Decimal | number | string | null;
  discountPercent?: Prisma.Decimal | number | string | null;
  taxPercent?: Prisma.Decimal | number | string | null;
  uomId?: number | null;
  description?: string | null;
  expectedDate?: Date | null;
  requisitionLineId?: number | null;
}

export interface CalculatedLine {
  productId: number;
  lineNumber: number;
  description: string | null;
  quantity: Prisma.Decimal;
  uomId: number | null;
  unitPrice: Prisma.Decimal;
  discountPercent: Prisma.Decimal;
  taxPercent: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  expectedDate: Date | null;
  requisitionLineId: number | null;
}

export async function resolveSupplierPrice(
  input: {
    supplierId: number;
    productId: number;
    quantity: Prisma.Decimal;
    onDate?: Date;
  },
  client: Client = prisma
): Promise<{
  unitPrice: Prisma.Decimal;
  source: "PRICE_TIER" | "CATALOGUE";
} | null> {
  const onDate = input.onDate ?? new Date();

  const catalogue = await client.supplierProduct.findFirst({
    where: {
      supplierId: input.supplierId,
      productId: input.productId,
      isActive: true,
      validFrom: { lte: onDate },
      OR: [{ validTo: null }, { validTo: { gte: onDate } }],
    },
    include: { priceTiers: { orderBy: { minQuantity: "desc" } } },
    orderBy: { validFrom: "desc" },
  });

  if (!catalogue) return null;

  const tier = catalogue.priceTiers.find(entry =>
    input.quantity.greaterThanOrEqualTo(entry.minQuantity)
  );
  if (tier) return { unitPrice: tier.unitPrice, source: "PRICE_TIER" };

  return { unitPrice: catalogue.unitPrice, source: "CATALOGUE" };
}

export async function calculatePurchaseLines(
  input: { supplierId: number; lines: PurchaseLineInput[]; orderDate?: Date },
  client: Client = prisma
): Promise<{
  lines: CalculatedLine[];
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  netTotal: Prisma.Decimal;
}> {
  if (input.lines.length === 0) {
    throw new DomainError("A purchase document needs at least one line", {
      code: "VALIDATION_ERROR",
    });
  }

  const calculated: CalculatedLine[] = [];
  let subtotal = ZERO;
  let discountTotal = ZERO;
  let taxTotal = ZERO;

  for (const [index, line] of input.lines.entries()) {
    const quantity = requirePositive(line.quantity, `lines[${index}].quantity`);

    const product = await client.product.findUnique({
      where: { id: line.productId },
    });
    if (!product) throw new NotFoundError(`Product ${line.productId}`);
    if (!product.active || !product.isPurchasable) {
      throw new DomainError(`${product.code} is not active and purchasable`, {
        code: "NOT_PURCHASABLE",
      });
    }

    let unitPrice: Prisma.Decimal;
    if (
      line.unitPrice !== undefined &&
      line.unitPrice !== null &&
      line.unitPrice !== ""
    ) {
      unitPrice = requireNonNegative(
        line.unitPrice,
        `lines[${index}].unitPrice`
      );
    } else {
      const resolved = await resolveSupplierPrice(
        {
          supplierId: input.supplierId,
          productId: line.productId,
          quantity,
          onDate: input.orderDate,
        },
        client
      );
      if (!resolved) {
        throw new DomainError(
          `No price on record for ${product.code} with this supplier. Add it to the supplier catalogue or enter a unit price on the line.`,
          { code: "PRICE_NOT_FOUND" }
        );
      }
      unitPrice = resolved.unitPrice;
    }

    const discountPercent = line.discountPercent
      ? requireNonNegative(line.discountPercent, "discountPercent")
      : ZERO;
    const taxPercent = line.taxPercent
      ? requireNonNegative(line.taxPercent, "taxPercent")
      : ZERO;
    if (discountPercent.greaterThan(100)) {
      throw new DomainError(
        `lines[${index}].discountPercent cannot exceed 100`,
        { code: "VALIDATION_ERROR" }
      );
    }
    if (taxPercent.greaterThan(100)) {
      throw new DomainError(`lines[${index}].taxPercent cannot exceed 100`, {
        code: "VALIDATION_ERROR",
      });
    }

    const gross = roundMoney(quantity.times(unitPrice));
    const discountAmount = roundMoney(
      gross.times(discountPercent).dividedBy(100)
    );
    const net = roundMoney(gross.minus(discountAmount));
    const taxAmount = roundMoney(net.times(taxPercent).dividedBy(100));
    const lineTotal = roundMoney(net.plus(taxAmount));

    subtotal = subtotal.plus(gross);
    discountTotal = discountTotal.plus(discountAmount);
    taxTotal = taxTotal.plus(taxAmount);

    calculated.push({
      productId: line.productId,
      lineNumber: index + 1,
      description: line.description ?? product.description ?? null,
      quantity: roundQuantity(quantity),
      uomId: line.uomId ?? product.uomId,
      unitPrice: roundCost(unitPrice),
      discountPercent,
      taxPercent,
      taxAmount,
      lineTotal,
      expectedDate: line.expectedDate ?? null,
      requisitionLineId: line.requisitionLineId ?? null,
    });
  }

  return {
    lines: calculated,
    subtotal: roundMoney(subtotal),
    discountAmount: roundMoney(discountTotal),
    taxAmount: roundMoney(taxTotal),
    netTotal: roundMoney(subtotal.minus(discountTotal).plus(taxTotal)),
  };
}

export async function recalculatePurchaseOrderTotals(
  tx: Tx,
  purchaseOrderId: number
) {
  const order = await tx.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { lines: true },
  });
  if (!order) throw new NotFoundError("Purchase order");

  let subtotal = ZERO;
  let discountAmount = ZERO;
  let taxAmount = ZERO;

  for (const line of order.lines) {
    if (line.status === PurchaseOrderLineStatus.CANCELLED) continue;
    const gross = roundMoney(line.quantity.times(line.unitPrice));
    const discount = roundMoney(
      gross.times(line.discountPercent).dividedBy(100)
    );
    subtotal = subtotal.plus(gross);
    discountAmount = discountAmount.plus(discount);
    taxAmount = taxAmount.plus(line.taxAmount);
  }

  const grandTotal = roundMoney(
    subtotal.minus(discountAmount).plus(taxAmount).plus(order.shippingAmount)
  );

  return tx.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: {
      subtotal: roundMoney(subtotal),
      discountAmount: roundMoney(discountAmount),
      taxAmount: roundMoney(taxAmount),
      grandTotal,
    },
  });
}

export interface GrnLineInput {
  purchaseOrderLineId?: number | null;
  productId: number;
  receivedQuantity: Prisma.Decimal | number | string;

  acceptedQuantity?: Prisma.Decimal | number | string | null;
  rejectedQuantity?: Prisma.Decimal | number | string | null;
  unitCost?: Prisma.Decimal | number | string | null;
  uomId?: number | null;
  batchNumber?: string | null;
  serialNumbers?: string[];
  manufacturedDate?: Date | null;
  expiryDate?: Date | null;
  rejectionReason?: string | null;
  putawayBinId?: number | null;
}

export async function createGoodsReceipt(
  tx: Tx,
  input: {
    purchaseOrderId?: number | null;
    supplierId?: number | null;
    warehouseId?: number | null;
    receivedDate?: Date;
    supplierInvoiceNumber?: string | null;
    supplierInvoiceDate?: Date | null;
    vehicleNumber?: string | null;
    lrNumber?: string | null;
    notes?: string | null;
    lines: GrnLineInput[];
    receivedById: number;
    requiresQc?: boolean;
  }
) {
  if (input.lines.length === 0) {
    throw new DomainError("A goods receipt needs at least one line", {
      code: "VALIDATION_ERROR",
    });
  }

  let supplierId = input.supplierId ?? null;
  let warehouseId = input.warehouseId ?? null;
  let purchaseOrder: Prisma.PurchaseOrderGetPayload<{
    include: { lines: true };
  }> | null = null;

  if (input.purchaseOrderId) {
    purchaseOrder = await tx.purchaseOrder.findUnique({
      where: { id: input.purchaseOrderId },
      include: { lines: true },
    });
    if (!purchaseOrder) throw new NotFoundError("Purchase order");

    const receivable: PurchaseOrderStatus[] = [
      PurchaseOrderStatus.APPROVED,
      PurchaseOrderStatus.SENT,
      PurchaseOrderStatus.ACKNOWLEDGED,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ];
    if (!receivable.includes(purchaseOrder.status)) {
      throw new DomainError(
        `Purchase order ${purchaseOrder.poNumber} is ${purchaseOrder.status.toLowerCase()} and cannot receive goods`,
        { code: "PO_NOT_RECEIVABLE" }
      );
    }
    supplierId = purchaseOrder.supplierId;
    warehouseId = purchaseOrder.warehouseId;
  }

  if (!supplierId)
    throw new DomainError("A supplier is required", {
      code: "VALIDATION_ERROR",
    });
  if (!warehouseId)
    throw new DomainError("A warehouse is required", {
      code: "VALIDATION_ERROR",
    });

  const receivedDate = input.receivedDate ?? new Date();

  let isOnTime: boolean | null = null;
  let delayDays: number | null = null;
  const dueDate =
    purchaseOrder?.promisedDate ?? purchaseOrder?.expectedDeliveryDate ?? null;
  if (dueDate) {
    const diffMs = receivedDate.getTime() - dueDate.getTime();
    delayDays = Math.ceil(diffMs / 86_400_000);
    isOnTime = delayDays <= 0;
    if (delayDays < 0) delayDays = 0;
  }

  const grnNumber = await nextDocumentNumber(
    tx,
    SEQUENCE_KEYS.GOODS_RECEIPT,
    receivedDate
  );

  const preparedLines: Array<{
    data: Prisma.GoodsReceiptLineCreateWithoutGrnInput;
    receivedQuantity: Prisma.Decimal;
    acceptedQuantity: Prisma.Decimal;
    rejectedQuantity: Prisma.Decimal;
    unitCost: Prisma.Decimal;
  }> = [];

  let totalReceived = ZERO;
  let totalAccepted = ZERO;
  let totalRejected = ZERO;
  let totalValue = ZERO;

  for (const [index, line] of input.lines.entries()) {
    const receivedQuantity = requirePositive(
      line.receivedQuantity,
      `lines[${index}].receivedQuantity`
    );

    const product = await tx.product.findUnique({
      where: { id: line.productId },
    });
    if (!product) throw new NotFoundError(`Product ${line.productId}`);

    let unitCost: Prisma.Decimal | null = line.unitCost
      ? requireNonNegative(line.unitCost, "unitCost")
      : null;
    let poLine = null;

    if (line.purchaseOrderLineId) {
      poLine =
        purchaseOrder?.lines.find(
          entry => entry.id === line.purchaseOrderLineId
        ) ?? null;
      if (!poLine)
        throw new NotFoundError(
          `Purchase order line ${line.purchaseOrderLineId}`
        );
      if (poLine.productId !== line.productId) {
        throw new DomainError(
          `Line ${index + 1} does not match the product on the purchase order line`,
          {
            code: "PO_LINE_PRODUCT_MISMATCH",
          }
        );
      }
      const outstanding = poLine.quantity.minus(poLine.receivedQuantity);
      if (receivedQuantity.greaterThan(outstanding)) {
        throw new DomainError(
          `Line ${index + 1}: only ${outstanding.toFixed(4)} of ${product.code} is still outstanding on ${purchaseOrder?.poNumber}`,
          { status: 409, code: "OVER_RECEIPT" }
        );
      }
      if (unitCost === null) unitCost = poLine.unitPrice;
    }

    if (unitCost === null) {
      throw new DomainError(
        `Line ${index + 1}: a unit cost is required when receiving without a purchase order line`,
        { code: "UNIT_COST_REQUIRED" }
      );
    }

    const requiresQc = input.requiresQc ?? false;
    const rejectedQuantity = line.rejectedQuantity
      ? requireNonNegative(line.rejectedQuantity, "rejectedQuantity")
      : ZERO;
    const acceptedQuantity = line.acceptedQuantity
      ? requireNonNegative(line.acceptedQuantity, "acceptedQuantity")
      : requiresQc
        ? ZERO
        : roundQuantity(receivedQuantity.minus(rejectedQuantity));

    if (acceptedQuantity.plus(rejectedQuantity).greaterThan(receivedQuantity)) {
      throw new DomainError(
        `Line ${index + 1}: accepted plus rejected cannot exceed the received quantity`,
        { code: "QUANTITY_MISMATCH" }
      );
    }

    if (product.trackingType === "SERIAL") {
      const serials = line.serialNumbers ?? [];
      if (!receivedQuantity.equals(serials.length)) {
        throw new DomainError(
          `Line ${index + 1}: ${product.code} is serial tracked, so ${receivedQuantity.toFixed(0)} serial number(s) are required but ${serials.length} were provided`,
          { code: "SERIAL_COUNT_MISMATCH" }
        );
      }
      if (new Set(serials).size !== serials.length) {
        throw new DomainError(
          `Line ${index + 1}: duplicate serial numbers in the same receipt`,
          {
            code: "DUPLICATE_SERIAL",
          }
        );
      }
    }
    if (product.trackingType === "BATCH" && !line.batchNumber) {
      throw new DomainError(
        `Line ${index + 1}: ${product.code} is batch tracked and needs a batch number`,
        {
          code: "BATCH_NUMBER_REQUIRED",
        }
      );
    }

    totalReceived = totalReceived.plus(receivedQuantity);
    totalAccepted = totalAccepted.plus(acceptedQuantity);
    totalRejected = totalRejected.plus(rejectedQuantity);
    totalValue = totalValue.plus(receivedQuantity.times(unitCost));

    preparedLines.push({
      receivedQuantity,
      acceptedQuantity,
      rejectedQuantity,
      unitCost,
      data: {
        product: { connect: { id: line.productId } },
        ...(line.purchaseOrderLineId
          ? { purchaseOrderLine: { connect: { id: line.purchaseOrderLineId } } }
          : {}),
        lineNumber: index + 1,
        receivedQuantity: roundQuantity(receivedQuantity),
        acceptedQuantity: roundQuantity(acceptedQuantity),
        rejectedQuantity: roundQuantity(rejectedQuantity),
        ...((line.uomId ?? product.uomId)
          ? {
              uom: { connect: { id: (line.uomId ?? product.uomId) as number } },
            }
          : {}),
        unitCost: roundCost(unitCost),
        batchNumber: line.batchNumber ?? null,
        serialNumbers: line.serialNumbers ?? [],
        manufacturedDate: line.manufacturedDate ?? null,
        expiryDate: line.expiryDate ?? null,
        qcResult: requiresQc ? QcResult.PENDING : QcResult.PASS,
        rejectionReason: line.rejectionReason ?? null,
        ...(line.putawayBinId
          ? { putawayBin: { connect: { id: line.putawayBinId } } }
          : {}),
      },
    });
  }

  const grn = await tx.goodsReceiptNote.create({
    data: {
      grnNumber,
      purchaseOrderId: input.purchaseOrderId ?? null,
      supplierId,
      warehouseId,
      status: input.requiresQc ? GrnStatus.PENDING_QC : GrnStatus.DRAFT,
      receivedDate,
      supplierInvoiceNumber: input.supplierInvoiceNumber ?? null,
      supplierInvoiceDate: input.supplierInvoiceDate ?? null,
      vehicleNumber: input.vehicleNumber ?? null,
      lrNumber: input.lrNumber ?? null,
      isOnTime,
      delayDays,
      totalReceivedQuantity: roundQuantity(totalReceived),
      totalAcceptedQuantity: roundQuantity(totalAccepted),
      totalRejectedQuantity: roundQuantity(totalRejected),
      totalValue: roundMoney(totalValue),
      notes: input.notes ?? null,
      receivedById: input.receivedById,
      lines: { create: preparedLines.map(line => line.data) },
    },
    include: { lines: true },
  });

  return grn;
}

export async function postGoodsReceipt(
  tx: Tx,
  input: { grnId: number; userId: number; createPutawayTasks?: boolean }
) {
  const grn = await tx.goodsReceiptNote.findUnique({
    where: { id: input.grnId },
    include: { lines: { include: { product: true } }, purchaseOrder: true },
  });
  if (!grn) throw new NotFoundError("Goods receipt note");
  if (grn.status === GrnStatus.CANCELLED) {
    throw new DomainError("A cancelled goods receipt cannot be posted", {
      code: "GRN_CANCELLED",
    });
  }
  if (
    grn.status === GrnStatus.PENDING_QC ||
    grn.status === GrnStatus.QC_IN_PROGRESS
  ) {
    const pending = grn.lines.filter(
      line => line.qcResult === QcResult.PENDING
    );
    if (pending.length > 0) {
      throw new DomainError(
        `${pending.length} line(s) on ${grn.grnNumber} are still awaiting quality inspection`,
        { code: "QC_PENDING" }
      );
    }
  }

  const postedLines: Array<{
    grnLineId: number;
    lotIds: number[];
    quantity: Prisma.Decimal;
  }> = [];

  const orderedLines = [...grn.lines].sort((a, b) => a.productId - b.productId);

  for (const line of orderedLines) {
    if (line.isPosted) continue;
    if (line.acceptedQuantity.lessThanOrEqualTo(0)) {
      await tx.goodsReceiptLine.update({
        where: { id: line.id },
        data: { isPosted: true },
      });
      continue;
    }

    const lotIds: number[] = [];

    if (
      line.product.trackingType === "SERIAL" &&
      line.serialNumbers.length > 0
    ) {
      const acceptedCount = Number(line.acceptedQuantity.toFixed(0));
      for (const serialNumber of line.serialNumbers.slice(0, acceptedCount)) {
        const received = await receiveStock(tx, {
          productId: line.productId,
          warehouseId: grn.warehouseId,
          binId: line.putawayBinId,
          quantity: 1,
          unitCost: line.unitCost,
          movementType: StockMovementType.PURCHASE_RECEIPT,
          lot: {
            serialNumber,
            batchNumber: line.batchNumber,
            manufacturedDate: line.manufacturedDate,
            expiryDate: line.expiryDate,
            supplierId: grn.supplierId,
          },
          reference: {
            type: "GOODS_RECEIPT",
            id: grn.id,
            number: grn.grnNumber,
          },
          performedById: input.userId,
          occurredAt: grn.receivedDate,
          uomId: line.uomId,
        });
        lotIds.push(received.lotId);
      }
    } else {
      const received = await receiveStock(tx, {
        productId: line.productId,
        warehouseId: grn.warehouseId,
        binId: line.putawayBinId,
        quantity: line.acceptedQuantity,
        unitCost: line.unitCost,
        movementType: StockMovementType.PURCHASE_RECEIPT,
        lot: {
          batchNumber: line.batchNumber,
          manufacturedDate: line.manufacturedDate,
          expiryDate: line.expiryDate,
          supplierId: grn.supplierId,
        },
        reference: { type: "GOODS_RECEIPT", id: grn.id, number: grn.grnNumber },
        performedById: input.userId,
        occurredAt: grn.receivedDate,
        uomId: line.uomId,
      });
      lotIds.push(received.lotId);

      if (input.createPutawayTasks !== false) {
        await createPutawayTask(tx, {
          warehouseId: grn.warehouseId,
          productId: line.productId,
          lotId: received.lotId,
          fromBinId: received.binId,
          quantity: line.acceptedQuantity,
          grnLineId: line.id,
          priority: 3,
          notes: `Putaway for ${grn.grnNumber}`,
        });
      }
    }

    await tx.goodsReceiptLine.update({
      where: { id: line.id },
      data: { isPosted: true, lotId: lotIds[0] ?? null },
    });

    if (line.purchaseOrderLineId) {
      const poLine = await tx.purchaseOrderLine.findUnique({
        where: { id: line.purchaseOrderLineId },
      });
      if (poLine) {
        const receivedQuantity = roundQuantity(
          poLine.receivedQuantity.plus(line.receivedQuantity)
        );
        const acceptedQuantity = roundQuantity(
          poLine.acceptedQuantity.plus(line.acceptedQuantity)
        );
        const rejectedQuantity = roundQuantity(
          poLine.rejectedQuantity.plus(line.rejectedQuantity)
        );
        await tx.purchaseOrderLine.update({
          where: { id: poLine.id },
          data: {
            receivedQuantity,
            acceptedQuantity,
            rejectedQuantity,
            status: receivedQuantity.greaterThanOrEqualTo(poLine.quantity)
              ? PurchaseOrderLineStatus.RECEIVED
              : PurchaseOrderLineStatus.PARTIALLY_RECEIVED,
          },
        });
      }
    }

    postedLines.push({
      grnLineId: line.id,
      lotIds,
      quantity: line.acceptedQuantity,
    });
  }

  await tx.goodsReceiptNote.update({
    where: { id: grn.id },
    data: { status: GrnStatus.COMPLETED, postedAt: new Date() },
  });

  if (grn.purchaseOrderId) {
    await refreshPurchaseOrderStatus(tx, grn.purchaseOrderId);
  }

  return { grnId: grn.id, grnNumber: grn.grnNumber, postedLines };
}

export async function refreshPurchaseOrderStatus(
  tx: Tx,
  purchaseOrderId: number
) {
  const order = await tx.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { lines: true },
  });
  if (!order) throw new NotFoundError("Purchase order");

  const openLines = order.lines.filter(
    line => line.status !== PurchaseOrderLineStatus.CANCELLED
  );
  if (openLines.length === 0) return order;

  const fullyReceived = openLines.every(line =>
    line.receivedQuantity.greaterThanOrEqualTo(line.quantity)
  );
  const partiallyReceived = openLines.some(line =>
    line.receivedQuantity.greaterThan(0)
  );

  let status = order.status;
  if (fullyReceived) status = PurchaseOrderStatus.RECEIVED;
  else if (partiallyReceived) status = PurchaseOrderStatus.PARTIALLY_RECEIVED;

  if (status === order.status) return order;

  return tx.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status },
  });
}

export async function recordQualityCheck(
  tx: Tx,
  input: {
    grnLineId: number;
    inspectedQuantity: Prisma.Decimal | number | string;
    acceptedQuantity: Prisma.Decimal | number | string;
    rejectedQuantity?: Prisma.Decimal | number | string | null;
    sampleSize?: Prisma.Decimal | number | string | null;
    defectType?: string | null;
    remarks?: string | null;
    inspectedById: number;
    parameters?: Array<{
      parameterName: string;
      specification?: string | null;
      minValue?: Prisma.Decimal | number | string | null;
      maxValue?: Prisma.Decimal | number | string | null;
      observedValue?: string | null;
    }>;
  }
) {
  await tx.$queryRaw`
    SELECT "id" FROM "goods_receipt_lines" WHERE "id" = ${input.grnLineId} FOR UPDATE
  `;
  const grnLine = await tx.goodsReceiptLine.findUnique({
    where: { id: input.grnLineId },
    include: { grn: true, product: { select: { code: true } } },
  });
  if (!grnLine) throw new NotFoundError("Goods receipt line");
  if (grnLine.isPosted) {
    throw new DomainError(
      "This receipt line has already been posted to stock and cannot be re-inspected",
      {
        code: "ALREADY_POSTED",
      }
    );
  }

  const inspectedQuantity = roundQuantity(
    requirePositive(input.inspectedQuantity, "inspectedQuantity")
  );
  const acceptedQuantity = roundQuantity(
    requireNonNegative(input.acceptedQuantity, "acceptedQuantity")
  );
  const rejectedQuantity =
    input.rejectedQuantity !== undefined && input.rejectedQuantity !== null
      ? roundQuantity(
          requireNonNegative(input.rejectedQuantity, "rejectedQuantity")
        )
      : roundQuantity(inspectedQuantity.minus(acceptedQuantity));

  if (inspectedQuantity.greaterThan(grnLine.receivedQuantity)) {
    throw new DomainError(
      `Inspected quantity exceeds the ${grnLine.receivedQuantity.toFixed(4)} received for ${grnLine.product.code}`,
      { code: "QUANTITY_MISMATCH" }
    );
  }
  if (!acceptedQuantity.plus(rejectedQuantity).equals(inspectedQuantity)) {
    throw new DomainError(
      "acceptedQuantity plus rejectedQuantity must equal inspectedQuantity",
      { code: "QUANTITY_MISMATCH" }
    );
  }

  const sampleSize =
    input.sampleSize === undefined || input.sampleSize === null
      ? ZERO
      : roundQuantity(requirePositive(input.sampleSize, "sampleSize"));
  if (sampleSize.greaterThan(inspectedQuantity)) {
    throw new DomainError("sampleSize cannot exceed inspectedQuantity", {
      code: "QUANTITY_MISMATCH",
    });
  }

  if ((input.parameters?.length ?? 0) > 100) {
    throw new DomainError("parameters cannot contain more than 100 rows", {
      code: "VALIDATION_ERROR",
    });
  }

  const parameterRows = (input.parameters ?? []).map((parameter, index) => {
    const parameterName = parameter.parameterName.trim();
    if (parameterName.length === 0 || parameterName.length > 200) {
      throw new DomainError(
        `parameters[${index}].parameterName is required and cannot exceed 200 characters`,
        { code: "VALIDATION_ERROR" }
      );
    }
    const min =
      parameter.minValue !== undefined && parameter.minValue !== null
        ? toDecimal(parameter.minValue, "minValue")
        : null;
    const max =
      parameter.maxValue !== undefined && parameter.maxValue !== null
        ? toDecimal(parameter.maxValue, "maxValue")
        : null;
    if (min !== null && max !== null && min.greaterThan(max)) {
      throw new DomainError(
        `parameters[${index}].minValue cannot exceed maxValue`,
        { code: "VALIDATION_ERROR" }
      );
    }

    let isPassed = true;
    if (min !== null || max !== null) {
      if (
        parameter.observedValue === undefined ||
        parameter.observedValue === null ||
        parameter.observedValue.trim() === ""
      ) {
        isPassed = false;
      } else {
        const observed = toDecimal(
          parameter.observedValue,
          `parameters[${index}].observedValue`
        );
        if (min !== null && observed.lessThan(min)) isPassed = false;
        if (max !== null && observed.greaterThan(max)) isPassed = false;
      }
    }

    return {
      parameterName,
      specification: parameter.specification ?? null,
      minValue: min,
      maxValue: max,
      observedValue: parameter.observedValue ?? null,
      isPassed,
    };
  });

  let result: QcResult;
  if (
    rejectedQuantity.isZero() &&
    parameterRows.every(parameter => parameter.isPassed)
  ) {
    result = QcResult.PASS;
  } else if (acceptedQuantity.isZero()) {
    result = QcResult.FAIL;
  } else {
    result = QcResult.CONDITIONAL_PASS;
  }

  const qcNumber = await nextDocumentNumber(tx, SEQUENCE_KEYS.QUALITY_CHECK);
  const qualityCheck = await tx.qualityCheck.create({
    data: {
      qcNumber,
      grnId: grnLine.grnId,
      grnLineId: grnLine.id,
      sampleSize,
      inspectedQuantity,
      acceptedQuantity,
      rejectedQuantity,
      result,
      defectType: input.defectType ?? null,
      remarks: input.remarks ?? null,
      inspectedById: input.inspectedById,
      parameters: { create: parameterRows },
    },
    include: { parameters: true },
  });

  await tx.goodsReceiptLine.update({
    where: { id: grnLine.id },
    data: {
      qcResult: result,
      acceptedQuantity,
      rejectedQuantity,
      rejectionReason: input.defectType ?? grnLine.rejectionReason,
    },
  });

  const lines = await tx.goodsReceiptLine.findMany({
    where: { grnId: grnLine.grnId },
  });
  const stillPending = lines.some(line => line.qcResult === QcResult.PENDING);
  await tx.goodsReceiptNote.update({
    where: { id: grnLine.grnId },
    data: {
      status: stillPending ? GrnStatus.QC_IN_PROGRESS : GrnStatus.PENDING_QC,
      totalAcceptedQuantity: roundQuantity(
        lines.reduce((acc, line) => acc.plus(line.acceptedQuantity), ZERO)
      ),
      totalRejectedQuantity: roundQuantity(
        lines.reduce((acc, line) => acc.plus(line.rejectedQuantity), ZERO)
      ),
    },
  });

  return qualityCheck;
}
