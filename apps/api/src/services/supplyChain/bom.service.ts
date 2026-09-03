import { prisma } from "@repo/db";
import { Prisma, BomStatus, BomChangeType } from "@prisma/client";
import { DomainError, NotFoundError } from "./errors.js";
import { ZERO, requirePositive, roundCost, roundQuantity } from "./decimal.js";

type Tx = Prisma.TransactionClient;
type Client = Tx | typeof prisma;

const MAX_EXPLOSION_DEPTH = 25;

export interface ExplodedComponent {
  level: number;
  path: string;
  bomId: number;
  bomComponentId: number;
  productId: number;
  productCode: string;
  productName: string;
  itemType: string;
  uomCode: string | null;

  quantityPerParent: Prisma.Decimal;

  requiredQuantity: Prisma.Decimal;
  scrapPercent: Prisma.Decimal;
  isPhantom: boolean;
  isOptional: boolean;
  hasChildBom: boolean;
  childBomId: number | null;
  unitCost: Prisma.Decimal;
  extendedCost: Prisma.Decimal;
  substitutes: Array<{
    productId: number;
    productCode: string;
    productName: string;
    priority: number;
    conversionFactor: Prisma.Decimal;
  }>;
}

interface BomNodeCache {
  [bomId: number]: BomWithComponents;
}

type BomWithComponents = Prisma.BillOfMaterialsGetPayload<{
  include: {
    uom: true;
    product: true;
    components: {
      include: {
        componentProduct: true;
        uom: true;
        substitutes: { include: { substituteProduct: true } };
      };
    };
  };
}>;

const BOM_INCLUDE = {
  uom: true,
  product: true,
  components: {
    include: {
      componentProduct: true,
      uom: true,
      substitutes: { include: { substituteProduct: true } },
    },
    orderBy: { lineNumber: "asc" },
  },
} as const;

export async function resolveBomForProduct(
  productId: number,
  bomId?: number | null,
  client: Client = prisma
): Promise<BomWithComponents> {
  if (bomId) {
    const bom = await client.billOfMaterials.findUnique({
      where: { id: bomId },
      include: BOM_INCLUDE,
    });
    if (!bom) throw new NotFoundError("Bill of materials");
    if (bom.productId !== productId) {
      throw new DomainError(
        "The selected BOM does not belong to this product",
        { code: "BOM_PRODUCT_MISMATCH" }
      );
    }
    return bom;
  }

  const now = new Date();
  const active = await client.billOfMaterials.findMany({
    where: {
      productId,
      status: BomStatus.ACTIVE,
      OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }],
    },
    include: BOM_INCLUDE,
    orderBy: [{ isDefault: "desc" }, { version: "desc" }],
  });

  const chosen = active[0];
  if (!chosen) {
    throw new DomainError(
      "This product has no active bill of materials in effect today",
      { code: "NO_ACTIVE_BOM" }
    );
  }
  return chosen;
}

async function loadActiveBomFor(
  productId: number,
  cache: BomNodeCache,
  client: Client
): Promise<BomWithComponents | null> {
  const now = new Date();
  const bom = await client.billOfMaterials.findFirst({
    where: {
      productId,
      status: BomStatus.ACTIVE,
      OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }],
    },
    include: BOM_INCLUDE,
    orderBy: [{ isDefault: "desc" }, { version: "desc" }],
  });
  if (bom) cache[bom.id] = bom;
  return bom;
}

export async function explodeBom(
  options: {
    productId: number;
    bomId?: number | null;
    quantity?: Prisma.Decimal | number | string;

    maxLevels?: number;
  },
  client: Client = prisma
): Promise<{
  bom: BomWithComponents;
  components: ExplodedComponent[];
  totalMaterialCost: Prisma.Decimal;
}> {
  const buildQuantity = requirePositive(options.quantity ?? 1, "quantity");

  const rootBom = await resolveBomForProduct(
    options.productId,
    options.bomId,
    client
  );
  const cache: BomNodeCache = { [rootBom.id]: rootBom };
  const flattened: ExplodedComponent[] = [];

  const walk = async (
    bom: BomWithComponents,
    multiplier: Prisma.Decimal,
    level: number,
    path: string,
    visiting: Set<number>
  ): Promise<void> => {
    if (level > MAX_EXPLOSION_DEPTH) {
      throw new DomainError(
        `BOM structure exceeds the maximum depth of ${MAX_EXPLOSION_DEPTH} levels; check for a circular reference`,
        { code: "BOM_TOO_DEEP" }
      );
    }

    const perOutputUnit = requirePositive(
      bom.outputQuantity,
      `BOM ${bom.bomNumber} outputQuantity`
    );

    for (const component of bom.components) {
      const scrapMultiplier = new Prisma.Decimal(1).plus(
        component.scrapPercent.dividedBy(100)
      );
      const perParent = component.quantity
        .dividedBy(perOutputUnit)
        .times(scrapMultiplier)
        .times(multiplier);

      if (visiting.has(component.componentProductId)) {
        throw new DomainError(
          `Circular BOM reference detected: ${component.componentProduct.code} appears inside its own structure (${path})`,
          { status: 409, code: "BOM_CIRCULAR_REFERENCE" }
        );
      }

      let childBom: BomWithComponents | null = null;
      const canDescend =
        options.maxLevels === undefined || level < options.maxLevels;
      if (
        (component.componentProduct.isManufactured || component.isPhantom) &&
        canDescend
      ) {
        childBom = await loadActiveBomFor(
          component.componentProductId,
          cache,
          client
        );
      }

      const componentPath = path
        ? `${path} > ${component.componentProduct.code}`
        : component.componentProduct.code;
      const unitCost = component.componentProduct.standardCost ?? ZERO;
      const requiredQuantity = roundQuantity(perParent.times(buildQuantity));

      if (!component.isPhantom) {
        flattened.push({
          level,
          path: componentPath,
          bomId: bom.id,
          bomComponentId: component.id,
          productId: component.componentProductId,
          productCode: component.componentProduct.code,
          productName: component.componentProduct.name,
          itemType: component.componentProduct.itemType,
          uomCode: component.uom?.code ?? null,
          quantityPerParent: roundQuantity(perParent),
          requiredQuantity,
          scrapPercent: component.scrapPercent,
          isPhantom: component.isPhantom,
          isOptional: component.isOptional,
          hasChildBom: !!childBom,
          childBomId: childBom?.id ?? null,
          unitCost,
          extendedCost: roundCost(requiredQuantity.times(unitCost)),
          substitutes: component.substitutes
            .filter(substitute => substitute.isActive)
            .sort((a, b) => a.priority - b.priority)
            .map(substitute => ({
              productId: substitute.substituteProductId,
              productCode: substitute.substituteProduct.code,
              productName: substitute.substituteProduct.name,
              priority: substitute.priority,
              conversionFactor: substitute.conversionFactor,
            })),
        });
      }

      if (childBom) {
        const nextVisiting = new Set(visiting);
        nextVisiting.add(component.componentProductId);
        await walk(childBom, perParent, level + 1, componentPath, nextVisiting);
      }
    }
  };

  await walk(
    rootBom,
    new Prisma.Decimal(1),
    1,
    rootBom.product.code,
    new Set([options.productId])
  );

  const totalMaterialCost = flattened
    .filter(component => !component.hasChildBom)
    .reduce((acc, component) => acc.plus(component.extendedCost), ZERO);

  return {
    bom: rootBom,
    components: flattened,
    totalMaterialCost: roundCost(totalMaterialCost),
  };
}

export async function rollUpBomCost(
  bomId: number,
  options: { persist?: boolean; changedById?: number } = {},
  client: Client = prisma
): Promise<{
  bomId: number;
  materialCost: Prisma.Decimal;
  laborCost: Prisma.Decimal;
  overheadCost: Prisma.Decimal;
  totalUnitCost: Prisma.Decimal;
  lines: Array<{
    productId: number;
    productCode: string;
    productName: string;
    quantityPerUnit: Prisma.Decimal;
    unitCost: Prisma.Decimal;
    extendedCost: Prisma.Decimal;
    source: "ROLLED_UP" | "STANDARD_COST";
  }>;
  missingCosts: Array<{
    productId: number;
    productCode: string;
    productName: string;
  }>;
}> {
  const bom = await client.billOfMaterials.findUnique({
    where: { id: bomId },
    include: BOM_INCLUDE,
  });
  if (!bom) throw new NotFoundError("Bill of materials");

  const perOutputUnit = bom.outputQuantity.isZero()
    ? new Prisma.Decimal(1)
    : bom.outputQuantity;

  const lines: Array<{
    productId: number;
    productCode: string;
    productName: string;
    quantityPerUnit: Prisma.Decimal;
    unitCost: Prisma.Decimal;
    extendedCost: Prisma.Decimal;
    source: "ROLLED_UP" | "STANDARD_COST";
  }> = [];
  const missingCosts: Array<{
    productId: number;
    productCode: string;
    productName: string;
  }> = [];

  let materialCost = ZERO;

  for (const component of bom.components) {
    const scrapMultiplier = new Prisma.Decimal(1).plus(
      component.scrapPercent.dividedBy(100)
    );
    const quantityPerUnit = roundQuantity(
      component.quantity.dividedBy(perOutputUnit).times(scrapMultiplier)
    );

    let unitCost: Prisma.Decimal | null = null;
    let source: "ROLLED_UP" | "STANDARD_COST" = "STANDARD_COST";

    if (component.componentProduct.isManufactured) {
      const childBom = await client.billOfMaterials.findFirst({
        where: {
          productId: component.componentProductId,
          status: BomStatus.ACTIVE,
        },
        orderBy: [{ isDefault: "desc" }, { version: "desc" }],
        select: {
          id: true,
          rolledUpCost: true,
          laborCost: true,
          overheadCost: true,
        },
      });
      if (childBom) {
        const childResult = await rollUpBomCost(
          childBom.id,
          { persist: options.persist, changedById: options.changedById },
          client
        );
        unitCost = childResult.totalUnitCost;
        source = "ROLLED_UP";
        missingCosts.push(...childResult.missingCosts);
      }
    }

    if (unitCost === null) {
      unitCost = component.componentProduct.standardCost ?? null;
      if (unitCost === null) {
        missingCosts.push({
          productId: component.componentProductId,
          productCode: component.componentProduct.code,
          productName: component.componentProduct.name,
        });
        unitCost = ZERO;
      }
    }

    const extendedCost = roundCost(quantityPerUnit.times(unitCost));
    materialCost = materialCost.plus(extendedCost);

    lines.push({
      productId: component.componentProductId,
      productCode: component.componentProduct.code,
      productName: component.componentProduct.name,
      quantityPerUnit,
      unitCost,
      extendedCost,
      source,
    });
  }

  materialCost = roundCost(materialCost);
  const totalUnitCost = roundCost(
    materialCost.plus(bom.laborCost).plus(bom.overheadCost)
  );

  if (options.persist) {
    await client.billOfMaterials.update({
      where: { id: bom.id },
      data: { rolledUpCost: totalUnitCost, costedAt: new Date() },
    });
    if (options.changedById) {
      await client.bomChangeLog.create({
        data: {
          bomId: bom.id,
          changeType: BomChangeType.COST_ROLLED_UP,
          fieldName: "rolledUpCost",
          oldValue: bom.rolledUpCost?.toString() ?? null,
          newValue: totalUnitCost.toString(),
          description: `Cost rolled up to ${totalUnitCost.toString()} per unit`,
          changedById: options.changedById,
        },
      });
    }
  }

  return {
    bomId: bom.id,
    materialCost,
    laborCost: bom.laborCost,
    overheadCost: bom.overheadCost,
    totalUnitCost,
    lines,
    missingCosts: missingCosts.filter(
      (item, index, all) =>
        all.findIndex(other => other.productId === item.productId) === index
    ),
  };
}

export async function assertNoCircularReference(
  parentProductId: number,
  componentProductId: number,
  client: Client = prisma
): Promise<void> {
  if (parentProductId === componentProductId) {
    throw new DomainError("A product cannot be a component of itself", {
      status: 409,
      code: "BOM_CIRCULAR_REFERENCE",
    });
  }

  const visited = new Set<number>();
  const queue: number[] = [componentProductId];

  while (queue.length > 0) {
    const currentProductId = queue.shift() as number;
    if (visited.has(currentProductId)) continue;
    visited.add(currentProductId);

    if (visited.size > 5000) {
      throw new DomainError("BOM structure is too large to validate", {
        code: "BOM_TOO_LARGE",
      });
    }

    const boms = await client.billOfMaterials.findMany({
      where: {
        productId: currentProductId,
        status: {
          in: [BomStatus.ACTIVE, BomStatus.DRAFT, BomStatus.PENDING_APPROVAL],
        },
      },
      select: { components: { select: { componentProductId: true } } },
    });

    for (const bom of boms) {
      for (const component of bom.components) {
        if (component.componentProductId === parentProductId) {
          throw new DomainError(
            "Adding this component would create a circular BOM reference",
            { status: 409, code: "BOM_CIRCULAR_REFERENCE" }
          );
        }
        queue.push(component.componentProductId);
      }
    }
  }
}

export async function whereUsed(productId: number, client: Client = prisma) {
  const components = await client.bomComponent.findMany({
    where: { componentProductId: productId },
    include: {
      bom: {
        select: {
          id: true,
          bomNumber: true,
          name: true,
          version: true,
          revision: true,
          status: true,
          product: { select: { id: true, code: true, name: true } },
        },
      },
      uom: { select: { code: true } },
    },
    orderBy: { bomId: "asc" },
  });

  const substitutes = await client.bomComponentSubstitute.findMany({
    where: { substituteProductId: productId, isActive: true },
    include: {
      bomComponent: {
        include: {
          bom: {
            select: {
              id: true,
              bomNumber: true,
              name: true,
              status: true,
              product: { select: { id: true, code: true, name: true } },
            },
          },
          componentProduct: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  return {
    usedAsComponent: components.map(component => ({
      bomId: component.bom.id,
      bomNumber: component.bom.bomNumber,
      bomName: component.bom.name,
      version: component.bom.version,
      revision: component.bom.revision,
      status: component.bom.status,
      parentProduct: component.bom.product,
      quantity: component.quantity,
      uomCode: component.uom?.code ?? null,
      scrapPercent: component.scrapPercent,
    })),
    usedAsSubstitute: substitutes.map(substitute => ({
      bomId: substitute.bomComponent.bom.id,
      bomNumber: substitute.bomComponent.bom.bomNumber,
      bomName: substitute.bomComponent.bom.name,
      status: substitute.bomComponent.bom.status,
      parentProduct: substitute.bomComponent.bom.product,
      substitutesFor: substitute.bomComponent.componentProduct,
      priority: substitute.priority,
      conversionFactor: substitute.conversionFactor,
    })),
  };
}

export async function reviseBom(
  tx: Tx,
  bomId: number,
  options: {
    changedById: number;
    reason?: string | null;
    revision?: string | null;
  }
) {
  const source = await tx.billOfMaterials.findUnique({
    where: { id: bomId },
    include: { components: { include: { substitutes: true } } },
  });
  if (!source) throw new NotFoundError("Bill of materials");

  const highest = await tx.billOfMaterials.findFirst({
    where: { productId: source.productId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (highest?.version ?? source.version) + 1;

  const nextRevision =
    options.revision ??
    String.fromCharCode(
      Math.min(source.revision.charCodeAt(0) + 1, "Z".charCodeAt(0))
    );

  const bomNumber = `${source.bomNumber}-V${nextVersion}`;

  const created = await tx.billOfMaterials.create({
    data: {
      bomNumber,
      productId: source.productId,
      name: source.name,
      version: nextVersion,
      revision: nextRevision,
      status: BomStatus.DRAFT,
      isDefault: false,
      outputQuantity: source.outputQuantity,
      uomId: source.uomId,
      laborCost: source.laborCost,
      overheadCost: source.overheadCost,
      notes: source.notes,
      previousVersionId: source.id,
      createdById: options.changedById,
    },
  });

  for (const component of source.components) {
    const copied = await tx.bomComponent.create({
      data: {
        bomId: created.id,
        componentProductId: component.componentProductId,
        lineNumber: component.lineNumber,
        quantity: component.quantity,
        uomId: component.uomId,
        scrapPercent: component.scrapPercent,
        isOptional: component.isOptional,
        isPhantom: component.isPhantom,
        operationSequence: component.operationSequence,
        referenceDesignator: component.referenceDesignator,
        notes: component.notes,
      },
    });

    for (const substitute of component.substitutes) {
      await tx.bomComponentSubstitute.create({
        data: {
          bomComponentId: copied.id,
          substituteProductId: substitute.substituteProductId,
          priority: substitute.priority,
          conversionFactor: substitute.conversionFactor,
          isActive: substitute.isActive,
          notes: substitute.notes,
        },
      });
    }
  }

  await tx.bomChangeLog.create({
    data: {
      bomId: created.id,
      changeType: BomChangeType.REVISED,
      oldValue: `${source.bomNumber} v${source.version}${source.revision}`,
      newValue: `${created.bomNumber} v${created.version}${created.revision}`,
      description: `Revised from ${source.bomNumber} (version ${source.version}, revision ${source.revision})`,
      reason: options.reason ?? null,
      changedById: options.changedById,
    },
  });

  return created;
}

export async function logBomChange(
  tx: Tx,
  input: {
    bomId: number;
    changeType: BomChangeType;
    description: string;
    changedById: number;
    fieldName?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    reason?: string | null;
  }
) {
  return tx.bomChangeLog.create({
    data: {
      bomId: input.bomId,
      changeType: input.changeType,
      fieldName: input.fieldName ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      description: input.description,
      reason: input.reason ?? null,
      changedById: input.changedById,
    },
  });
}
