export const PERMISSIONS = [
  "inventory.view",
  "inventory.manage",
  "warehouse.view",
  "warehouse.manage",
  "materials.view",
  "materials.manage",
  "bom.view",
  "bom.manage",
  "production.view",
  "production.manage",
  "purchasing.view",
  "purchasing.manage",
  "suppliers.view",
  "suppliers.manage",

  "leads.view",
  "leads.manage",
  "accounts.view",
  "accounts.manage",
  "opportunities.view",
  "opportunities.manage",
  "quotes.view",
  "quotes.manage",
  "salesOrders.view",
  "salesOrders.manage",
  "products.view",
  "products.manage",
  "pricebooks.manage",
  "approvals.act",

  "finance.view",
  "finance.manage",

  "campaigns.view",
  "campaigns.manage",
  "whatsapp.manage",

  "analytics.view",
  "reports.export",
  "data.import",
  "settings.manage",
  "integrations.manage",
  "users.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET = new Set<string>(PERMISSIONS);

const IMPLIED_PERMISSIONS: Partial<Record<Permission, Permission[]>> = {
  "inventory.manage": ["inventory.view"],
  "warehouse.manage": ["warehouse.view"],
  "materials.manage": ["materials.view"],
  "bom.manage": ["bom.view"],
  "production.manage": ["production.view"],
  "purchasing.manage": ["purchasing.view"],
  "suppliers.manage": ["suppliers.view"],
  "leads.manage": ["leads.view"],
  "accounts.manage": ["accounts.view"],
  "opportunities.manage": ["opportunities.view"],
  "quotes.manage": ["quotes.view"],
  "salesOrders.manage": ["salesOrders.view"],
  "products.manage": ["products.view"],
  "campaigns.manage": ["campaigns.view"],
  "finance.manage": ["finance.view"],
};

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && PERMISSION_SET.has(value);
}

export const PERMISSION_GROUPS: Array<{
  group: string;
  description: string;
  permissions: Array<{ value: Permission; label: string; hint?: string }>;
}> = [
  {
    group: "Inventory & warehouse",
    description: "Stock on hand, movements, bins and pick/pack execution.",
    permissions: [
      { value: "inventory.view", label: "View stock and valuation" },
      {
        value: "inventory.manage",
        label: "Post movements and counts",
        hint: "Adjustments change stock ledgers",
      },
      { value: "warehouse.view", label: "View warehouses and bins" },
      { value: "warehouse.manage", label: "Run pick, pack and putaway" },
    ],
  },
  {
    group: "Materials & production",
    description: "Component availability, requisitions and production orders.",
    permissions: [
      { value: "materials.view", label: "View availability and shortages" },
      { value: "materials.manage", label: "Raise and issue requisitions" },
      { value: "bom.view", label: "View bills of material" },
      { value: "bom.manage", label: "Create and revise BOMs" },
      { value: "production.view", label: "View production orders" },
      { value: "production.manage", label: "Release and book production" },
    ],
  },
  {
    group: "Purchasing",
    description: "Suppliers, requisitions, purchase orders and receipts.",
    permissions: [
      { value: "purchasing.view", label: "View orders and receipts" },
      {
        value: "purchasing.manage",
        label: "Raise, approve and receive orders",
        hint: "Includes committing spend",
      },
      { value: "suppliers.view", label: "View suppliers" },
      { value: "suppliers.manage", label: "Edit suppliers and pricing" },
    ],
  },
  {
    group: "Sales & CRM",
    description: "The lead-to-order pipeline.",
    permissions: [
      { value: "leads.view", label: "View leads" },
      { value: "leads.manage", label: "Edit, assign and import leads" },
      { value: "accounts.view", label: "View accounts and contacts" },
      { value: "accounts.manage", label: "Edit accounts and contacts" },
      { value: "opportunities.view", label: "View opportunities" },
      { value: "opportunities.manage", label: "Edit opportunities" },
      { value: "quotes.view", label: "View quotes" },
      { value: "quotes.manage", label: "Create and revise quotes" },
      { value: "salesOrders.view", label: "View sales orders" },
      { value: "salesOrders.manage", label: "Create and edit sales orders" },
      { value: "products.view", label: "View the product catalogue" },
      { value: "products.manage", label: "Edit products and categories" },
      { value: "pricebooks.manage", label: "Manage price books" },
      {
        value: "approvals.act",
        label: "Approve or reject requests",
        hint: "Discount and order approvals",
      },
    ],
  },
  {
    group: "Finance",
    description: "Invoices, payments, balances and financial operations.",
    permissions: [
      { value: "finance.view", label: "View invoices and payments" },
      {
        value: "finance.manage",
        label: "Manage invoices and payments",
        hint: "Includes posting financial transactions",
      },
    ],
  },
  {
    group: "Marketing",
    description: "Outbound campaigns and messaging.",
    permissions: [
      { value: "campaigns.view", label: "View campaigns" },
      { value: "campaigns.manage", label: "Create and send campaigns" },
      { value: "whatsapp.manage", label: "Manage WhatsApp templates" },
    ],
  },
  {
    group: "Platform",
    description: "Cross-cutting administration. Grant sparingly.",
    permissions: [
      { value: "analytics.view", label: "View dashboards and analytics" },
      { value: "reports.export", label: "Export data" },
      {
        value: "data.import",
        label: "Bulk import data",
        hint: "Can create or update thousands of records at once",
      },
      { value: "settings.manage", label: "Change workspace settings" },
      {
        value: "integrations.manage",
        label: "Manage provider credentials",
        hint: "Can replace encrypted third-party API credentials",
      },
      {
        value: "users.manage",
        label: "Manage users and permissions",
        hint: "Lets the holder grant themselves anything else",
      },
    ],
  },
];

export const SALES_DEFAULT_PERMISSIONS: Permission[] = [
  "leads.view",
  "leads.manage",
  "accounts.view",
  "accounts.manage",
  "opportunities.view",
  "opportunities.manage",
  "quotes.view",
  "quotes.manage",
  "salesOrders.view",
  "salesOrders.manage",
  "products.view",
  "analytics.view",
];

export function resolvePermissions(
  role: string,
  stored: readonly string[] | null | undefined
): Permission[] {
  if (role === "ADMIN") return [...PERMISSIONS];
  const explicit =
    role === "SALES"
      ? SALES_DEFAULT_PERMISSIONS
      : (stored ?? []).filter(isPermission);
  const resolved = new Set<Permission>(explicit);
  for (const permission of explicit) {
    for (const implied of IMPLIED_PERMISSIONS[permission] ?? []) {
      resolved.add(implied);
    }
  }
  return [...resolved];
}

export function roleHasPermission(
  role: string,
  stored: readonly string[] | null | undefined,
  permission: Permission
): boolean {
  if (role === "ADMIN") return true;
  return resolvePermissions(role, stored).includes(permission);
}
