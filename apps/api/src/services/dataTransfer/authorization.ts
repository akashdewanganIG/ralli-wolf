import { roleHasPermission, type Permission } from "@repo/db/permissions";

type TransferPermissionRule = {
  export: Permission;
  import?: Permission;
};

export const TRANSFER_PERMISSIONS = {
  leads: { export: "leads.view", import: "leads.manage" },
  contacts: { export: "accounts.view" },
  accounts: { export: "accounts.view", import: "accounts.manage" },
  opportunities: { export: "opportunities.view" },
  quotes: { export: "quotes.view" },
  "sales-orders": { export: "salesOrders.view" },
  products: { export: "products.view" },
  "price-books": { export: "pricebooks.manage" },
  warehouses: { export: "warehouse.view", import: "warehouse.manage" },
  suppliers: { export: "suppliers.view", import: "suppliers.manage" },
  "purchase-requisitions": { export: "purchasing.view" },
  "purchase-orders": { export: "purchasing.view" },
  "goods-receipts": { export: "purchasing.view" },
  "quality-checks": { export: "purchasing.view" },
  "stock-positions": { export: "inventory.view" },
  "stock-movements": { export: "inventory.view" },
  "stock-counts": { export: "inventory.view" },
  "reorder-rules": { export: "inventory.view" },
  "stock-alerts": { export: "inventory.view" },
  "stock-lots": { export: "inventory.view" },
  boms: { export: "bom.view" },
  "production-orders": { export: "production.view" },
  "work-centers": { export: "production.view", import: "production.manage" },
  "material-requisitions": { export: "materials.view" },
  "supplier-invoices": { export: "finance.view" },
  "customer-invoices": { export: "finance.view" },
  payments: { export: "finance.view" },
  users: { export: "users.manage" },
} as const satisfies Record<string, TransferPermissionRule>;

export type TransferEntityKey = keyof typeof TRANSFER_PERMISSIONS;
export type TransferOperation = "export" | "import";

export function canTransfer(
  role: string,
  storedPermissions: readonly string[] | null | undefined,
  entity: TransferEntityKey,
  operation: TransferOperation
): boolean {
  const rule: TransferPermissionRule = TRANSFER_PERMISSIONS[entity];

  if (operation === "export") {
    return (
      roleHasPermission(role, storedPermissions, "reports.export") &&
      roleHasPermission(role, storedPermissions, rule.export)
    );
  }

  return Boolean(
    rule.import &&
      roleHasPermission(role, storedPermissions, "data.import") &&
      roleHasPermission(role, storedPermissions, rule.import)
  );
}
