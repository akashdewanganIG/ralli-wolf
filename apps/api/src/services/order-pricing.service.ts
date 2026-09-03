import { Prisma } from "@prisma/client";
import { prisma } from "@repo/db";

const MAX_LINES = 100;
const MAX_QUANTITY_PER_PRODUCT = 1_000_000;

export class OrderPricingError extends Error {}

export interface RequestedOrderLine {
  productId: number;
  quantity: number;
}

const ORDER_CATALOGUE_SELECT = {
  id: true,
  name: true,
  code: true,
  imageUrl: true,
  description: true,
  categoryId: true,
  active: true,
  component: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ProductSelect;

async function configuredPriceBookId(): Promise<number> {
  const configured = process.env.ORDER_PRICE_BOOK_ID?.trim();
  if (configured) {
    const id = Number(configured);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new OrderPricingError("ORDER_PRICE_BOOK_ID is invalid");
    }
    const book = await prisma.priceBook.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
    if (!book) {
      throw new OrderPricingError("Configured order price book is not active");
    }
    return book.id;
  }

  const standard = await prisma.priceBook.findFirst({
    where: { name: "Standard Price Book", isActive: true },
    select: { id: true },
  });
  if (standard) return standard.id;

  const active = await prisma.priceBook.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { id: "asc" },
    take: 2,
  });
  if (active.length === 1) return active[0]!.id;
  throw new OrderPricingError(
    active.length === 0
      ? "No active price book is configured"
      : "Multiple price books are active; configure ORDER_PRICE_BOOK_ID"
  );
}

export async function resolveOrderLines(lines: RequestedOrderLine[]) {
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > MAX_LINES) {
    throw new OrderPricingError(`An order must contain 1-${MAX_LINES} lines`);
  }

  const quantities = new Map<number, number>();
  for (const line of lines) {
    if (
      !line ||
      !Number.isSafeInteger(line.productId) ||
      line.productId <= 0 ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity <= 0
    ) {
      throw new OrderPricingError(
        "Each line requires a valid product and a positive whole-number quantity"
      );
    }
    const quantity = (quantities.get(line.productId) ?? 0) + line.quantity;
    if (quantity > MAX_QUANTITY_PER_PRODUCT) {
      throw new OrderPricingError("Order quantity exceeds the supported limit");
    }
    quantities.set(line.productId, quantity);
  }

  const priceBookId = await configuredPriceBookId();
  const entries = await prisma.priceBookEntry.findMany({
    where: {
      priceBookId,
      productId: { in: [...quantities.keys()] },
      isActive: true,
      product: { active: true, isSellable: true },
    },
    select: {
      productId: true,
      listPrice: true,
    },
  });
  const byProduct = new Map(entries.map(entry => [entry.productId, entry]));

  const resolved = [...quantities].map(([productId, quantity]) => {
    const entry = byProduct.get(productId);
    if (!entry) {
      throw new OrderPricingError(
        `Product ${productId} is unavailable in the active price book`
      );
    }
    const unitPrice = new Prisma.Decimal(entry.listPrice).toDecimalPlaces(2);
    if (!unitPrice.isPositive()) {
      throw new OrderPricingError(
        `Product ${productId} has no valid sales price`
      );
    }
    return {
      productId,
      quantity,
      unitPrice,
      totalPrice: unitPrice.mul(quantity).toDecimalPlaces(2),
    };
  });

  const totalAmount = resolved.reduce(
    (total, line) => total.add(line.totalPrice),
    new Prisma.Decimal(0)
  );
  return { priceBookId, lines: resolved, totalAmount };
}

export async function getOrderCataloguePrices(productIds: number[]) {
  const priceBookId = await configuredPriceBookId();
  const entries = await prisma.priceBookEntry.findMany({
    where: {
      priceBookId,
      productId: { in: productIds },
      isActive: true,
    },
    select: { productId: true, listPrice: true },
  });
  return new Map(
    entries
      .filter(entry => new Prisma.Decimal(entry.listPrice).isPositive())
      .map(entry => [entry.productId, entry.listPrice.toFixed(2)])
  );
}

export async function getOrderCatalogueProducts(filters?: {
  categoryId?: number;
  search?: string;
}) {
  const search = filters?.search?.trim().slice(0, 100);
  const where: Prisma.ProductWhereInput = {
    active: true,
    isSellable: true,
    ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const products = await prisma.product.findMany({
    where,
    select: ORDER_CATALOGUE_SELECT,
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  const prices = await getOrderCataloguePrices(
    products.map(product => product.id)
  );
  return products
    .filter(product => prices.has(product.id))
    .map(product => ({ ...product, price: prices.get(product.id)! }));
}
