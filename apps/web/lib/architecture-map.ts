/**
 * Structured description of the platform, rendered by the Architecture &
 * User Flow page. Routes here are the real application routes taken from
 * `navigation-commands.ts` and the App Router tree — the map never invents a
 * destination. Nodes without a `route` are conceptual and do not behave as
 * links.
 *
 * Adding a module is a data change, not a layout change: append a node with
 * the right `parent`, and the diagram, search and flows pick it up.
 */

export type ArchNodeKind =
  | "module" // a top-level sidebar group
  | "section" // a sidebar sub-menu inside a module
  | "page" // a real, navigable application page
  | "concept" // something the system does that has no page of its own
  | "external"; // a third-party surface the platform talks to

export interface ArchNode {
  id: string;
  label: string;
  kind: ArchNodeKind;
  /** `null` for modules, otherwise the id of the owning node. */
  parent: string | null;
  /** Only set when a real page exists. Absent means "not a link". */
  route?: string;
  /** Opens in a new tab rather than routing in-app. */
  external?: boolean;
  /** Mirrors `adminOnly` in navigation-commands.ts. */
  adminOnly?: boolean;
  description: string;
  keywords?: string[];
}

export type ArchRelationKind =
  /** The one-way door between two modules. Drawn heaviest. */
  | "handoff"
  /** Normal "feeds data into" dependency. */
  | "feeds"
  /** Master data consumed by many modules. */
  | "shared"
  /** Written by a background job, with no human involved. */
  | "auto";

export interface ArchRelation {
  from: string;
  to: string;
  label: string;
  kind: ArchRelationKind;
}

export type FlowStepKind =
  | "start"
  | "action" // a person clicks something
  | "auto" // the system does it unprompted
  | "decision"
  | "end";

export interface FlowStep {
  id: string;
  label: string;
  kind: FlowStepKind;
  route?: string;
  note?: string;
  adminOnly?: boolean;
}

export interface UserFlow {
  id: string;
  title: string;
  summary: string;
  category: "Access" | "Marketing & Sales" | "Operations" | "Finance" | "Admin";
  steps: FlowStep[];
}

/* ------------------------------------------------------------------ */
/* Modules                                                             */
/* ------------------------------------------------------------------ */

const MODULES: ArchNode[] = [
  {
    id: "mod:overview",
    label: "Overview",
    kind: "module",
    parent: null,
    description: "Where everyone lands after signing in.",
  },
  {
    id: "mod:marketing",
    label: "Marketing & Sales",
    kind: "module",
    parent: null,
    description:
      "Demand side. Capturing interest, qualifying it, and turning it into an order.",
  },
  {
    id: "mod:supply",
    label: "Operations & Supply Chain",
    kind: "module",
    parent: null,
    description:
      "Supply side. Buying, storing, making and shipping physical goods.",
  },
  {
    id: "mod:finance",
    label: "Finance",
    kind: "module",
    parent: null,
    description:
      "Where both sides settle. You can only bill for what was received, and only invoice what was shipped.",
  },
  {
    id: "mod:admin",
    label: "Administration",
    kind: "module",
    parent: null,
    description: "Users, access, notifications and platform configuration.",
  },
  {
    id: "mod:platform",
    label: "Shared & Platform",
    kind: "module",
    parent: null,
    description:
      "Master data both halves depend on, plus the services and jobs running underneath.",
  },
];

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

const SECTIONS: ArchNode[] = [
  // Marketing & Sales
  {
    id: "sec:landing",
    label: "Landing Page",
    kind: "section",
    parent: "mod:marketing",
    description:
      "Public pages that capture enquiries and turn them into leads.",
  },
  {
    id: "sec:leads",
    label: "Lead Management",
    kind: "section",
    parent: "mod:marketing",
    description:
      "The lead book, who owns which lead, and the accounts and contacts they become.",
  },
  {
    id: "sec:campaigns",
    label: "Campaign Management",
    kind: "section",
    parent: "mod:marketing",
    description:
      "Audiences, and the email and WhatsApp campaigns sent to them.",
  },
  {
    id: "sec:sales",
    label: "Sales Management",
    kind: "section",
    parent: "mod:marketing",
    description:
      "The pipeline: products and prices through opportunity, quote and order.",
  },

  // Operations & Supply Chain
  {
    id: "sec:warehouse",
    label: "Warehouse",
    kind: "section",
    parent: "mod:supply",
    description:
      "The places goods are kept, and the work of putting them away, picking and packing them.",
  },
  {
    id: "sec:materials",
    label: "Materials",
    kind: "section",
    parent: "mod:supply",
    description:
      "What production needs, whether it is available, and what it consumed.",
  },
  {
    id: "sec:purchasing",
    label: "Purchasing",
    kind: "section",
    parent: "mod:supply",
    description: "Suppliers, and everything from requisition to goods receipt.",
  },
  {
    id: "sec:inventory",
    label: "Inventory",
    kind: "section",
    parent: "mod:supply",
    description:
      "The quantities themselves — positions, the ledger behind them, counts and alerts.",
  },
  {
    id: "sec:production",
    label: "BOM & Production",
    kind: "section",
    parent: "mod:supply",
    description: "What a product is made of, and the jobs that build it.",
  },
  {
    id: "sec:planning",
    label: "Planning",
    kind: "section",
    parent: "mod:supply",
    description:
      "Turning production orders into dated work on real machines, and checking it fits.",
  },

  // Platform
  {
    id: "sec:master",
    label: "Master data",
    kind: "section",
    parent: "mod:platform",
    description:
      "Records both Marketing & Sales and Operations read from. Change one here and both sides see it.",
  },
  {
    id: "sec:portals",
    label: "Entry points",
    kind: "section",
    parent: "mod:platform",
    description:
      "The separate front doors into the platform, each with its own sign-in.",
  },
  {
    id: "sec:jobs",
    label: "Background jobs",
    kind: "section",
    parent: "mod:platform",
    description:
      "Schedulers running inside the API. Nobody triggers these by hand.",
  },
  {
    id: "sec:integrations",
    label: "Integrations",
    kind: "section",
    parent: "mod:platform",
    description: "Third-party services the platform sends work to.",
  },
];

/* ------------------------------------------------------------------ */
/* Pages and concepts                                                  */
/* ------------------------------------------------------------------ */

const LEAVES: ArchNode[] = [
  // Overview
  {
    id: "page:dashboard",
    label: "Dashboard",
    kind: "page",
    parent: "mod:overview",
    route: "/",
    description: "Headline metrics across the whole platform.",
    keywords: ["home", "overview", "metrics"],
  },

  // Landing Page
  {
    id: "page:landing-builder",
    label: "Landing Page Builder",
    kind: "external",
    parent: "sec:landing",
    route: "https://app.landingi.com/landings",
    external: true,
    description: "Landingi, where the public pages themselves are built.",
    keywords: ["landingi", "builder"],
  },
  {
    id: "page:landing-trackers",
    label: "Landing Page Trackers",
    kind: "page",
    parent: "sec:landing",
    route: "/landing-page-trackers",
    description:
      "Which landing page each enquiry came from. Submissions arrive by webhook and become leads without anyone touching them.",
    keywords: ["attribution", "forms", "enquiries"],
  },

  // Lead Management
  {
    id: "page:lead-master",
    label: "Lead Master",
    kind: "page",
    parent: "sec:leads",
    route: "/leads/lead-master",
    description:
      "Every lead in the system. Created by hand, imported in bulk, or captured from a landing page.",
    keywords: ["leads", "enquiries", "prospects"],
  },
  {
    id: "page:leads-unassigned",
    label: "Unassigned Leads",
    kind: "page",
    parent: "sec:leads",
    route: "/leads/unassigned-leads",
    description: "Leads nobody owns yet. Assign them, or let a rep claim one.",
    keywords: ["queue", "pool", "claim"],
  },
  {
    id: "page:leads-assigned",
    label: "Assigned Leads",
    kind: "page",
    parent: "sec:leads",
    route: "/leads/assigned",
    description: "Leads with an owner, being worked.",
    keywords: ["mine", "owner"],
  },
  {
    id: "page:accounts",
    label: "Accounts",
    kind: "page",
    parent: "sec:leads",
    route: "/leads/accounts",
    description:
      "Customer organisations. Created when a qualified lead is converted.",
    keywords: ["customers", "companies", "organisations"],
  },
  {
    id: "page:contacts",
    label: "Contacts",
    kind: "page",
    parent: "sec:leads",
    route: "/leads/contacts",
    description: "People at those accounts. Created alongside the account.",
    keywords: ["people", "customers"],
  },

  // Campaign Management
  {
    id: "page:segments",
    label: "Segments",
    kind: "page",
    parent: "sec:campaigns",
    route: "/campaigns/segments",
    description:
      "Reusable audiences built from rules on city, state and keyword.",
    keywords: ["audience", "rules", "targeting"],
  },
  {
    id: "page:campaigns-email",
    label: "Email Campaigns",
    kind: "page",
    parent: "sec:campaigns",
    route: "/campaigns/email",
    description:
      "Read from Brevo, not from this database. Without Brevo configured the page cannot load.",
    keywords: ["brevo", "newsletter", "broadcast"],
  },
  {
    id: "page:campaigns-whatsapp",
    label: "WhatsApp Campaigns",
    kind: "page",
    parent: "sec:campaigns",
    route: "/campaigns/whatsapp",
    description:
      "Stored locally and sent through MSG91. Needs an approved template first.",
    keywords: ["msg91", "broadcast", "templates"],
  },
  {
    id: "page:whatsapp-templates",
    label: "Templates & Numbers",
    kind: "page",
    parent: "sec:campaigns",
    route: "/campaigns/whatsapp/management",
    description: "The approved templates and sender numbers campaigns draw on.",
    keywords: ["templates", "senders", "numbers"],
  },
  {
    id: "page:whatsapp-optouts",
    label: "Opt-outs",
    kind: "page",
    parent: "sec:campaigns",
    route: "/campaigns/whatsapp/opt-outs",
    description:
      "Anyone who replied STOP. Every campaign skips them automatically.",
    keywords: ["stop", "unsubscribe", "consent"],
  },

  // Sales Management
  {
    id: "page:products",
    label: "Product Configuration",
    kind: "page",
    parent: "sec:sales",
    route: "/sales/products",
    description:
      "The product catalogue and its categories. Shared by sales, purchasing, BOMs and stock.",
    keywords: ["products", "catalogue", "items", "categories", "sku"],
  },
  {
    id: "page:price-books",
    label: "Price Books",
    kind: "page",
    parent: "sec:sales",
    route: "/sales/price-books",
    description: "What a given customer is charged for a product.",
    keywords: ["pricing", "rates", "list price"],
  },
  {
    id: "page:opportunities",
    label: "Opportunities",
    kind: "page",
    parent: "sec:sales",
    route: "/sales/opportunities",
    description:
      "Live deals. Requires an account, and moves through a fixed stage sequence that sets its own win probability.",
    keywords: ["deals", "pipeline", "opps"],
  },
  {
    id: "page:quotes",
    label: "Quotes",
    kind: "page",
    parent: "sec:sales",
    route: "/sales/quotes",
    description:
      "Priced proposals raised from an opportunity, versioned A, B, C. Needs at least one line item.",
    keywords: ["proposal", "pricing", "pdf"],
  },
  {
    id: "page:sales-orders",
    label: "Orders",
    kind: "page",
    parent: "sec:sales",
    route: "/sales/orders",
    description:
      "Confirmed sales orders. Only an accepted, primary quote can become one.",
    keywords: ["sales orders", "so", "confirmed"],
  },
  {
    id: "page:approvals",
    label: "Approvals",
    kind: "page",
    parent: "sec:sales",
    route: "/sales/approvals",
    description:
      "Requests waiting on a decision, raised when a discount passes the configured threshold.",
    keywords: ["authorise", "sign off", "discount"],
  },

  // Warehouse
  {
    id: "page:warehouse",
    label: "Warehouses & Bins",
    kind: "page",
    parent: "sec:warehouse",
    route: "/warehouse",
    description:
      "Sites, and the zones, bins and pallets inside them. Nothing can hold stock until a bin exists, so this is the first thing to create.",
    keywords: ["warehouse", "sites", "zones", "bins", "pallets", "storage"],
  },
  {
    id: "page:putaway",
    label: "Putaway Queue",
    kind: "page",
    parent: "sec:warehouse",
    route: "/warehouse/putaway",
    description:
      "Stock that has arrived and needs shelving. Tasks appear here on their own when a goods receipt is posted.",
    keywords: ["putaway", "receiving", "shelve"],
  },
  {
    id: "page:pick-lists",
    label: "Pick Lists",
    kind: "page",
    parent: "sec:warehouse",
    route: "/warehouse/pick-lists",
    description:
      "Collecting goods for an order. One requested line becomes one task per bin the stock sits in.",
    keywords: ["picking", "fulfilment", "pick tasks"],
  },
  {
    id: "page:packages",
    label: "Packages",
    kind: "page",
    parent: "sec:warehouse",
    route: "/warehouse/packages",
    description:
      "Parcels packed and awaiting dispatch. Read only — packages are created by packing a pick list.",
    keywords: ["parcels", "shipping", "dispatch", "carrier"],
  },

  // Materials
  {
    id: "page:materials",
    label: "Material Master",
    kind: "page",
    parent: "sec:materials",
    route: "/materials",
    description: "The materials production draws on.",
    keywords: ["materials", "components", "parts"],
  },
  {
    id: "page:availability",
    label: "Build Availability",
    kind: "page",
    parent: "sec:materials",
    route: "/materials/availability",
    description:
      "Explodes a bill of materials against free stock and tells you how many units you can actually build.",
    keywords: ["can i build", "explode", "availability"],
  },
  {
    id: "page:shortages",
    label: "Shortages",
    kind: "page",
    parent: "sec:materials",
    route: "/materials/shortages",
    description: "What is missing, and what it is holding up.",
    keywords: ["missing", "gaps", "short"],
  },
  {
    id: "page:material-reqs",
    label: "Material Requisitions",
    kind: "page",
    parent: "sec:materials",
    route: "/materials/requisitions",
    description:
      "Asking the stores for parts. Issuing them consumes the stock.",
    keywords: ["issue", "stores", "draw"],
  },
  {
    id: "page:consumption",
    label: "Consumption & Wastage",
    kind: "page",
    parent: "sec:materials",
    route: "/materials/consumption",
    description: "What production actually used, and what was lost.",
    keywords: ["used", "scrap", "waste"],
  },

  // Purchasing
  {
    id: "page:purchasing",
    label: "Purchasing Overview",
    kind: "page",
    parent: "sec:purchasing",
    route: "/purchasing",
    description: "The buying side at a glance.",
    keywords: ["procurement", "buying"],
  },
  {
    id: "page:suppliers",
    label: "Suppliers",
    kind: "page",
    parent: "sec:purchasing",
    route: "/purchasing/suppliers",
    description: "Vendors, their contacts, and the prices agreed with them.",
    keywords: ["vendors", "supplier", "sourcing"],
  },
  {
    id: "page:purchase-reqs",
    label: "Purchase Requisitions",
    kind: "page",
    parent: "sec:purchasing",
    route: "/purchasing/requisitions",
    description:
      "A request to buy, before a real order exists. Can also be raised automatically when a reorder rule is breached.",
    keywords: ["request", "pr", "asking"],
  },
  {
    id: "page:purchase-orders",
    label: "Purchase Orders",
    kind: "page",
    parent: "sec:purchasing",
    route: "/purchasing/orders",
    description:
      "Orders placed with a supplier. Converting a requisition excludes lines already ordered, so it cannot double-order.",
    keywords: ["po", "orders", "buying"],
  },
  {
    id: "page:goods-receipts",
    label: "Goods Receipts",
    kind: "page",
    parent: "sec:purchasing",
    route: "/purchasing/goods-receipts",
    description:
      "What physically arrived. Paperwork only until it is posted to stock.",
    keywords: ["grn", "receiving", "arrived", "delivery"],
  },
  {
    id: "page:quality",
    label: "Quality Checks",
    kind: "page",
    parent: "sec:purchasing",
    route: "/purchasing/quality",
    description: "Inspection on receipt — pass, fail, or pass with conditions.",
    keywords: ["qc", "inspection", "reject"],
  },

  // Inventory
  {
    id: "page:inventory",
    label: "Inventory Overview",
    kind: "page",
    parent: "sec:inventory",
    route: "/inventory",
    description: "The stock position at a glance.",
    keywords: ["stock", "inventory"],
  },
  {
    id: "page:stock",
    label: "Stock Positions",
    kind: "page",
    parent: "sec:inventory",
    route: "/inventory/stock",
    description:
      "What is on hand, where, and how much of it is already reserved.",
    keywords: ["on hand", "balances", "quantities", "stock"],
  },
  {
    id: "page:movements",
    label: "Stock Ledger",
    kind: "page",
    parent: "sec:inventory",
    route: "/inventory/movements",
    description:
      "Append-only audit trail. Every quantity shown anywhere reconciles back to this.",
    keywords: ["movements", "ledger", "audit", "history"],
  },
  {
    id: "page:counts",
    label: "Stock Counts",
    kind: "page",
    parent: "sec:inventory",
    route: "/inventory/counts",
    description:
      "Counting what is physically there. Nothing changes until variances are posted.",
    keywords: ["stocktake", "cycle count", "variance"],
  },
  {
    id: "page:reorder-rules",
    label: "Reorder Policies",
    kind: "page",
    parent: "sec:inventory",
    route: "/inventory/reorder-rules",
    description:
      "Safety stock, reorder point and quantity per item per site. The sweep reads these.",
    keywords: ["reorder", "safety stock", "min max", "replenishment"],
  },
  {
    id: "page:alerts",
    label: "Inventory Alerts",
    kind: "page",
    parent: "sec:inventory",
    route: "/inventory/alerts",
    description:
      "Raised automatically when stock falls below a policy. Can raise a requisition on its own if enabled.",
    keywords: ["alerts", "low stock", "warnings"],
  },
  {
    id: "page:valuation",
    label: "Valuation",
    kind: "page",
    parent: "sec:inventory",
    route: "/inventory/valuation",
    description: "What the stock on hand is worth.",
    keywords: ["value", "cost", "worth"],
  },

  // BOM & Production
  {
    id: "page:bom",
    label: "Bills of Materials",
    kind: "page",
    parent: "sec:production",
    route: "/bom",
    description:
      "What a product is made of. Activating freezes it; changes need a revision.",
    keywords: ["bom", "recipe", "components", "structure"],
  },
  {
    id: "page:production",
    label: "Production Orders",
    kind: "page",
    parent: "sec:production",
    route: "/production",
    description:
      "Jobs that build a product. Needs an active bill of materials.",
    keywords: ["manufacturing", "works order", "build", "make"],
  },

  // Planning
  {
    id: "page:planning",
    label: "Production Board",
    kind: "page",
    parent: "sec:planning",
    route: "/planning",
    description:
      "Scheduling production orders onto work centres. Scheduling replaces previous steps rather than adding to them.",
    keywords: ["schedule", "board", "plan"],
  },
  {
    id: "page:capacity",
    label: "Capacity",
    kind: "page",
    parent: "sec:planning",
    route: "/planning/capacity",
    description: "Load per work centre per day, against real usable hours.",
    keywords: ["load", "utilisation", "hours"],
  },
  {
    id: "page:work-centers",
    label: "Work Centres",
    kind: "page",
    parent: "sec:planning",
    route: "/planning/work-centers",
    description:
      "Machines, lines and benches work can be scheduled on. Each sits inside a warehouse.",
    keywords: ["machines", "lines", "cells", "stations"],
  },

  // Finance
  {
    id: "page:finance",
    label: "Finance Overview",
    kind: "page",
    parent: "mod:finance",
    route: "/finance",
    description:
      "Payables and receivables side by side, with ageing, per currency.",
    keywords: ["finance", "money", "dashboard"],
  },
  {
    id: "page:payables",
    label: "Accounts Payable",
    kind: "page",
    parent: "mod:finance",
    route: "/finance/payables",
    description:
      "What is owed to suppliers. Invoices are raised from purchase orders already received against.",
    keywords: ["ap", "supplier invoices", "bills", "owed"],
  },
  {
    id: "page:receivables",
    label: "Accounts Receivable",
    kind: "page",
    parent: "mod:finance",
    route: "/finance/receivables",
    description:
      "What customers owe. Invoices are raised from sales orders already shipped.",
    keywords: ["ar", "customer invoices", "collections"],
  },
  {
    id: "page:payments",
    label: "Payments",
    kind: "page",
    parent: "mod:finance",
    route: "/finance/payments",
    description:
      "Every movement of money. Allocations decide an invoice's balance — it is never typed in directly.",
    keywords: ["cash", "receipts", "settlements"],
  },

  // Administration
  {
    id: "page:users",
    label: "User Management",
    kind: "page",
    parent: "mod:admin",
    route: "/admin/user-management",
    adminOnly: true,
    description:
      "People, their role, and the capabilities granted to them. ADMIN gets everything, SALES its defaults, CUSTOM only what is assigned.",
    keywords: ["users", "roles", "permissions", "access", "staff"],
  },
  {
    id: "page:notifications",
    label: "Notifications",
    kind: "page",
    parent: "mod:admin",
    route: "/admin/notifications",
    description: "Which alerts you receive, in-app and by email.",
    keywords: ["alerts", "email", "preferences"],
  },
  {
    id: "page:settings",
    label: "Settings",
    kind: "page",
    parent: "mod:admin",
    route: "/settings",
    description:
      "Platform configuration, including currency and the discount approval threshold.",
    keywords: ["configuration", "preferences", "currency", "threshold"],
  },
  {
    id: "page:admin-status",
    label: "Admin & System Status",
    kind: "page",
    parent: "mod:admin",
    route: "/admin",
    adminOnly: true,
    description: "Service health and administrative shortcuts.",
    keywords: ["health", "status", "system"],
  },
  {
    id: "page:whatsapp-accounts",
    label: "WhatsApp Accounts",
    kind: "page",
    parent: "mod:admin",
    route: "/admin/whatsapp-accounts",
    adminOnly: true,
    description: "Sender numbers and their stored credentials.",
    keywords: ["msg91", "senders", "numbers"],
  },
  {
    id: "page:integrations",
    label: "Integration Manager",
    kind: "page",
    parent: "mod:admin",
    route: "/integration-manager",
    adminOnly: true,
    description: "Encrypted API keys for the WhatsApp and email providers.",
    keywords: ["api keys", "providers", "credentials"],
  },

  // Shared master data
  {
    id: "concept:product-master",
    label: "Product",
    kind: "concept",
    parent: "sec:master",
    description:
      "One catalogue, read by quotes, price books, bills of materials, purchase orders and stock alike.",
    keywords: ["catalogue", "item", "sku"],
  },
  {
    id: "concept:warehouse-master",
    label: "Warehouse",
    kind: "concept",
    parent: "sec:master",
    description:
      "Required by purchase orders, stock, pick lists, production orders and work centres.",
    keywords: ["site", "plant", "location"],
  },
  {
    id: "concept:account-master",
    label: "Account & Contact",
    kind: "concept",
    parent: "sec:master",
    description:
      "Shared by opportunities, campaign audiences and accounts receivable.",
    keywords: ["customer", "company", "person"],
  },
  {
    id: "concept:session",
    label: "Session & Permissions",
    kind: "concept",
    parent: "sec:master",
    description:
      "An HttpOnly session cookie plus a named capability check on every API route. The interface mirrors these checks; the API is the authority.",
    keywords: ["auth", "login", "rbac", "roles", "security"],
  },

  // Entry points
  {
    id: "page:login",
    label: "Staff Sign-in",
    kind: "page",
    parent: "sec:portals",
    route: "/login",
    description:
      "Password, passwordless email code, or authenticator app, followed by a second factor where configured.",
    keywords: ["login", "sign in", "otp", "mfa", "2fa"],
  },
  {
    id: "page:aakraman",
    label: "Aakraman Portal",
    kind: "page",
    parent: "sec:portals",
    route: "/aakraman",
    description:
      "Field-sales portal with its own OTP sign-in. Books orders against the shared product catalogue as its own record type.",
    keywords: ["field sales", "mobile", "reps", "booking"],
  },
  {
    id: "page:subdealer",
    label: "Subdealer Registration",
    kind: "page",
    parent: "sec:portals",
    route: "/subdealer",
    description:
      "Public self-registration, verified by GST lookup and a phone code.",
    keywords: ["dealer", "register", "gst", "signup"],
  },

  // Background jobs
  {
    id: "concept:reorder-sweep",
    label: "Reorder sweep · 15 min",
    kind: "concept",
    parent: "sec:jobs",
    description:
      "Compares stock against every reorder policy and raises alerts. Where the policy allows it, raises a purchase requisition with nobody present.",
    keywords: ["replenishment", "automatic", "scheduler"],
  },
  {
    id: "concept:reservation-sweep",
    label: "Reservation sweep · 60 min",
    kind: "concept",
    parent: "sec:jobs",
    description: "Releases stock reservations that have expired.",
    keywords: ["reservations", "expiry", "scheduler"],
  },
  {
    id: "concept:supplier-sweep",
    label: "Supplier snapshot · 24 h",
    kind: "concept",
    parent: "sec:jobs",
    description: "Records supplier performance for the period.",
    keywords: ["performance", "scorecard", "scheduler"],
  },
  {
    id: "concept:overdue-sweep",
    label: "Overdue invoice sweep · 24 h",
    kind: "concept",
    parent: "sec:jobs",
    description: "Flags invoices that have passed their due date.",
    keywords: ["ageing", "overdue", "scheduler"],
  },
  {
    id: "concept:whatsapp-queue",
    label: "WhatsApp queue · 60 s",
    kind: "concept",
    parent: "sec:jobs",
    description: "Sends queued campaign messages.",
    keywords: ["sending", "queue", "scheduler"],
  },

  // Integrations
  {
    id: "ext:resend",
    label: "Resend",
    kind: "external",
    parent: "sec:integrations",
    description:
      "All transactional email — sign-in codes, approvals, quotes and alerts.",
    keywords: ["email", "smtp", "transactional"],
  },
  {
    id: "ext:brevo",
    label: "Brevo",
    kind: "external",
    parent: "sec:integrations",
    description:
      "Email campaigns live here, not in this database. The campaigns page reads from Brevo directly.",
    keywords: ["email marketing", "campaigns"],
  },
  {
    id: "ext:msg91",
    label: "MSG91",
    kind: "external",
    parent: "sec:integrations",
    description: "WhatsApp templates and sending.",
    keywords: ["whatsapp", "sms", "otp"],
  },
  {
    id: "ext:s3",
    label: "AWS S3",
    kind: "external",
    parent: "sec:integrations",
    description: "Campaign media, warehouse photos and generated documents.",
    keywords: ["storage", "files", "media", "uploads"],
  },
  {
    id: "ext:landingi",
    label: "Landingi",
    kind: "external",
    parent: "sec:integrations",
    description: "Landing pages, whose submissions arrive here as leads.",
    keywords: ["landing pages", "forms"],
  },
];

export const ARCH_NODES: ArchNode[] = [...MODULES, ...SECTIONS, ...LEAVES];

/* ------------------------------------------------------------------ */
/* Relationships                                                       */
/* ------------------------------------------------------------------ */

export const ARCH_RELATIONS: ArchRelation[] = [
  // The two doors between the halves.
  {
    from: "page:sales-orders",
    to: "page:pick-lists",
    label: "a confirmed order is the only thing that pulls stock",
    kind: "handoff",
  },
  {
    from: "page:packages",
    to: "page:receivables",
    label: "nothing is invoiced until it ships",
    kind: "handoff",
  },

  // Shared master data reaching into both halves.
  {
    from: "concept:product-master",
    to: "page:products",
    label: "catalogue",
    kind: "shared",
  },
  {
    from: "concept:product-master",
    to: "page:quotes",
    label: "line items",
    kind: "shared",
  },
  {
    from: "concept:product-master",
    to: "page:bom",
    label: "components",
    kind: "shared",
  },
  {
    from: "concept:product-master",
    to: "page:purchase-orders",
    label: "what to buy",
    kind: "shared",
  },
  {
    from: "concept:product-master",
    to: "page:stock",
    label: "what is on the shelf",
    kind: "shared",
  },
  {
    from: "concept:warehouse-master",
    to: "page:warehouse",
    label: "sites and bins",
    kind: "shared",
  },
  {
    from: "concept:warehouse-master",
    to: "page:stock",
    label: "stock lives in a bin",
    kind: "shared",
  },
  {
    from: "concept:warehouse-master",
    to: "page:work-centers",
    label: "a centre sits in a plant",
    kind: "shared",
  },
  {
    from: "concept:account-master",
    to: "page:opportunities",
    label: "a deal needs an account",
    kind: "shared",
  },
  {
    from: "concept:account-master",
    to: "page:receivables",
    label: "who owes us",
    kind: "shared",
  },

  // Marketing into sales.
  {
    from: "page:landing-trackers",
    to: "page:lead-master",
    label: "enquiry becomes a lead",
    kind: "auto",
  },
  {
    from: "page:segments",
    to: "page:campaigns-email",
    label: "audience",
    kind: "feeds",
  },
  {
    from: "page:segments",
    to: "page:campaigns-whatsapp",
    label: "audience",
    kind: "feeds",
  },
  {
    from: "page:lead-master",
    to: "page:leads-unassigned",
    label: "nobody owns it yet",
    kind: "feeds",
  },
  {
    from: "page:leads-unassigned",
    to: "page:leads-assigned",
    label: "assigned or claimed",
    kind: "feeds",
  },
  {
    from: "page:leads-assigned",
    to: "page:accounts",
    label: "converted when qualified",
    kind: "feeds",
  },
  {
    from: "page:accounts",
    to: "page:contacts",
    label: "created together",
    kind: "feeds",
  },
  {
    from: "page:accounts",
    to: "page:opportunities",
    label: "a deal against a customer",
    kind: "feeds",
  },
  {
    from: "page:opportunities",
    to: "page:quotes",
    label: "needs one line item minimum",
    kind: "feeds",
  },
  {
    from: "page:quotes",
    to: "page:approvals",
    label: "discount over the threshold",
    kind: "feeds",
  },
  {
    from: "page:quotes",
    to: "page:sales-orders",
    label: "accepted and primary only",
    kind: "feeds",
  },
  {
    from: "page:price-books",
    to: "page:quotes",
    label: "what the customer pays",
    kind: "feeds",
  },

  // Purchasing and inventory.
  {
    from: "page:reorder-rules",
    to: "page:alerts",
    label: "swept every 15 minutes",
    kind: "auto",
  },
  {
    from: "page:alerts",
    to: "page:purchase-reqs",
    label: "auto requisition where enabled",
    kind: "auto",
  },
  {
    from: "page:purchase-reqs",
    to: "page:purchase-orders",
    label: "approved and converted",
    kind: "feeds",
  },
  {
    from: "page:suppliers",
    to: "page:purchase-orders",
    label: "who we buy from",
    kind: "feeds",
  },
  {
    from: "page:purchase-orders",
    to: "page:goods-receipts",
    label: "goods arrive",
    kind: "feeds",
  },
  {
    from: "page:goods-receipts",
    to: "page:quality",
    label: "inspect on receipt",
    kind: "feeds",
  },
  {
    from: "page:goods-receipts",
    to: "page:stock",
    label: "post to stock",
    kind: "feeds",
  },
  {
    from: "page:goods-receipts",
    to: "page:putaway",
    label: "putaway task raised automatically",
    kind: "auto",
  },
  {
    from: "page:putaway",
    to: "page:stock",
    label: "shelved into a bin",
    kind: "feeds",
  },
  {
    from: "page:counts",
    to: "page:stock",
    label: "post variances",
    kind: "feeds",
  },
  {
    from: "page:stock",
    to: "page:movements",
    label: "every event writes a line",
    kind: "feeds",
  },
  {
    from: "page:stock",
    to: "page:valuation",
    label: "what it is worth",
    kind: "feeds",
  },
  {
    from: "page:stock",
    to: "page:pick-lists",
    label: "allocated and reserved",
    kind: "feeds",
  },

  // Making.
  {
    from: "page:bom",
    to: "page:production",
    label: "must be active",
    kind: "feeds",
  },
  {
    from: "page:stock",
    to: "page:availability",
    label: "can we build it",
    kind: "feeds",
  },
  {
    from: "page:availability",
    to: "page:production",
    label: "checked before release",
    kind: "feeds",
  },
  {
    from: "page:production",
    to: "page:material-reqs",
    label: "release reserves materials",
    kind: "feeds",
  },
  {
    from: "page:material-reqs",
    to: "page:consumption",
    label: "parts leave stock",
    kind: "feeds",
  },
  {
    from: "page:production",
    to: "page:stock",
    label: "book finished goods",
    kind: "feeds",
  },
  {
    from: "page:material-reqs",
    to: "page:shortages",
    label: "what could not be met",
    kind: "feeds",
  },

  // Planning.
  {
    from: "page:work-centers",
    to: "page:planning",
    label: "what work can run on",
    kind: "feeds",
  },
  {
    from: "page:bom",
    to: "page:planning",
    label: "an order needs a routing",
    kind: "feeds",
  },
  {
    from: "page:production",
    to: "page:planning",
    label: "the job to schedule",
    kind: "feeds",
  },
  {
    from: "page:planning",
    to: "page:capacity",
    label: "load per centre per day",
    kind: "feeds",
  },

  // Warehouse internals.
  {
    from: "page:warehouse",
    to: "page:putaway",
    label: "tasks land stock in these bins",
    kind: "feeds",
  },
  {
    from: "page:warehouse",
    to: "page:pick-lists",
    label: "picking walks bins in sequence order",
    kind: "feeds",
  },
  {
    from: "page:pick-lists",
    to: "page:packages",
    label: "pack only what was picked",
    kind: "feeds",
  },

  // Finance.
  {
    from: "page:goods-receipts",
    to: "page:payables",
    label: "receive before you can be billed",
    kind: "handoff",
  },
  {
    from: "page:payables",
    to: "page:payments",
    label: "money out",
    kind: "feeds",
  },
  {
    from: "page:receivables",
    to: "page:payments",
    label: "money in",
    kind: "feeds",
  },

  // Platform.
  {
    from: "concept:session",
    to: "page:users",
    label: "roles and capabilities",
    kind: "shared",
  },
  {
    from: "concept:reorder-sweep",
    to: "page:alerts",
    label: "raises alerts",
    kind: "auto",
  },
  {
    from: "concept:reservation-sweep",
    to: "page:stock",
    label: "releases expired holds",
    kind: "auto",
  },
  {
    from: "concept:overdue-sweep",
    to: "page:receivables",
    label: "flags overdue invoices",
    kind: "auto",
  },
  {
    from: "concept:whatsapp-queue",
    to: "page:campaigns-whatsapp",
    label: "sends queued messages",
    kind: "auto",
  },
  {
    from: "concept:supplier-sweep",
    to: "page:suppliers",
    label: "performance snapshot",
    kind: "auto",
  },
  {
    from: "ext:landingi",
    to: "page:landing-trackers",
    label: "submissions arrive by webhook",
    kind: "auto",
  },
  {
    from: "ext:brevo",
    to: "page:campaigns-email",
    label: "campaigns are read from Brevo",
    kind: "feeds",
  },
  {
    from: "ext:msg91",
    to: "page:campaigns-whatsapp",
    label: "templates and delivery",
    kind: "feeds",
  },
  {
    from: "ext:resend",
    to: "page:quotes",
    label: "quote emails",
    kind: "feeds",
  },
  {
    from: "ext:s3",
    to: "page:warehouse",
    label: "site photos",
    kind: "feeds",
  },
  {
    from: "page:aakraman",
    to: "page:sales-orders",
    label: "field orders reviewed here",
    kind: "feeds",
  },
];

/* ------------------------------------------------------------------ */
/* User flows                                                          */
/* ------------------------------------------------------------------ */

export const USER_FLOWS: UserFlow[] = [
  {
    id: "flow:signin",
    title: "Sign in to the dashboard",
    summary:
      "Three ways in, one session. The interface mirrors your permissions; the API enforces them.",
    category: "Access",
    steps: [
      { id: "s1", label: "Open the app", kind: "start" },
      {
        id: "s2",
        label: "Existing session still valid?",
        kind: "decision",
        note: "Checked on every load",
      },
      {
        id: "s3",
        label: "Sign in",
        kind: "action",
        route: "/login",
        note: "Password, emailed code, or authenticator app",
      },
      {
        id: "s4",
        label: "Second factor where configured",
        kind: "action",
        note: "Email code or authenticator",
      },
      {
        id: "s5",
        label: "Session cookie issued",
        kind: "auto",
        note: "HttpOnly — browser JavaScript never sees the token",
      },
      {
        id: "s6",
        label: "Navigation filtered to your capabilities",
        kind: "auto",
      },
      { id: "s7", label: "Dashboard", kind: "end", route: "/" },
    ],
  },
  {
    id: "flow:navigate",
    title: "Find and open a record",
    summary:
      "The shape every module shares: pick a module, filter its listing, then open or create a record.",
    category: "Access",
    steps: [
      { id: "s1", label: "Dashboard", kind: "start", route: "/" },
      {
        id: "s2",
        label: "Pick a module from the sidebar, or press Ctrl/Cmd + K",
        kind: "action",
        note: "The command palette lists the same destinations as the sidebar",
      },
      {
        id: "s3",
        label: "Open the module's listing",
        kind: "action",
        route: "/leads/lead-master",
        note: "Every module lands on a list first",
      },
      {
        id: "s4",
        label: "Filter, search or sort the list",
        kind: "action",
      },
      { id: "s5", label: "New record, or an existing one?", kind: "decision" },
      {
        id: "s6",
        label: "Create from the listing's action button",
        kind: "action",
        note: "Opens a dialog on most screens",
      },
      {
        id: "s7",
        label: "Open a row to its detail page",
        kind: "action",
        note: "The detail route needs a record id, so it has no fixed address",
      },
      { id: "s8", label: "Edit, then save", kind: "end" },
    ],
  },
  {
    id: "flow:day-one",
    title: "Set up a new workspace",
    summary:
      "The database enforces this order. Stock cannot exist before somewhere to put it does.",
    category: "Operations",
    steps: [
      {
        id: "s1",
        label: "Create users",
        kind: "action",
        route: "/admin/user-management",
        adminOnly: true,
      },
      {
        id: "s2",
        label: "Create a warehouse",
        kind: "action",
        route: "/warehouse",
        note: "Always first",
      },
      {
        id: "s3",
        label: "Add zones, then bins",
        kind: "action",
        route: "/warehouse",
        note: "Or generate a whole rack layout at once",
      },
      {
        id: "s4",
        label: "Create categories and products",
        kind: "action",
        route: "/sales/products",
      },
      {
        id: "s5",
        label: "Create suppliers and agreed prices",
        kind: "action",
        route: "/purchasing/suppliers",
      },
      {
        id: "s6",
        label: "Set reorder policies",
        kind: "action",
        route: "/inventory/reorder-rules",
      },
      { id: "s7", label: "Stock can now exist", kind: "end" },
    ],
  },
  {
    id: "flow:lead-to-order",
    title: "Lead to sales order",
    summary:
      "The full demand-side pipeline. A lead can arrive with nobody touching it; everything after is a decision.",
    category: "Marketing & Sales",
    steps: [
      {
        id: "s1",
        label: "Lead arrives — added, imported, or captured",
        kind: "start",
        route: "/leads/lead-master",
      },
      {
        id: "s2",
        label: "Assigned to anyone?",
        kind: "decision",
        route: "/leads/unassigned-leads",
      },
      {
        id: "s3",
        label: "Assign or claim it",
        kind: "action",
        route: "/leads/assigned",
      },
      { id: "s4", label: "Qualified?", kind: "decision" },
      {
        id: "s5",
        label: "Convert — creates the account and contact together",
        kind: "action",
        route: "/leads/accounts",
      },
      {
        id: "s6",
        label: "Create an opportunity and add products",
        kind: "action",
        route: "/sales/opportunities",
      },
      {
        id: "s7",
        label: "Probability updates itself as the stage moves",
        kind: "auto",
      },
      {
        id: "s8",
        label: "Raise a quote",
        kind: "action",
        route: "/sales/quotes",
        note: "Numbers it, snapshots pricing, and marks the opportunity quoted",
      },
      {
        id: "s9",
        label: "Discount over the threshold?",
        kind: "decision",
        route: "/sales/approvals",
      },
      {
        id: "s10",
        label: "Approver decides",
        kind: "action",
        route: "/sales/approvals",
      },
      {
        id: "s11",
        label: "Accepted and primary quote?",
        kind: "decision",
      },
      {
        id: "s12",
        label: "Convert to a sales order",
        kind: "action",
        route: "/sales/orders",
        note: "Closes the opportunity as won",
      },
      { id: "s13", label: "Ready to fulfil", kind: "end" },
    ],
  },
  {
    id: "flow:campaign",
    title: "Build an audience and run a campaign",
    summary:
      "Segments are reusable. WhatsApp lives here; email lives in Brevo.",
    category: "Marketing & Sales",
    steps: [
      {
        id: "s1",
        label: "Create a segment",
        kind: "start",
        route: "/campaigns/segments",
        note: "Rules on city, state and keyword",
      },
      { id: "s2", label: "Email or WhatsApp?", kind: "decision" },
      {
        id: "s3",
        label: "Approved template available?",
        kind: "decision",
        route: "/campaigns/whatsapp/management",
      },
      {
        id: "s4",
        label: "Create and submit a template",
        kind: "action",
        route: "/campaigns/whatsapp/management",
      },
      {
        id: "s5",
        label: "Schedule the campaign",
        kind: "action",
        route: "/campaigns/whatsapp",
      },
      {
        id: "s6",
        label: "Queue sends every 60 seconds",
        kind: "auto",
        note: "Opt-outs are skipped automatically",
      },
      {
        id: "s7",
        label: "Delivery tracked — sent, delivered, read, failed",
        kind: "end",
        route: "/campaigns/whatsapp",
      },
    ],
  },
  {
    id: "flow:buy",
    title: "Buy stock and get it on the shelf",
    summary:
      "Posting to stock is the committing step. Until then a receipt is only paperwork.",
    category: "Operations",
    steps: [
      {
        id: "s1",
        label: "Reorder sweep finds a breach, or someone asks",
        kind: "start",
        route: "/inventory/alerts",
      },
      {
        id: "s2",
        label: "Purchase requisition",
        kind: "action",
        route: "/purchasing/requisitions",
        note: "Raised automatically where the policy allows it",
      },
      {
        id: "s3",
        label: "Convert to a purchase order",
        kind: "action",
        route: "/purchasing/orders",
        note: "Lines already ordered are excluded",
      },
      {
        id: "s4",
        label: "Submit for approval, then send to the supplier",
        kind: "action",
        route: "/purchasing/orders",
      },
      {
        id: "s5",
        label: "Record the goods receipt",
        kind: "action",
        route: "/purchasing/goods-receipts",
        note: "Paperwork only — stock has not moved",
      },
      {
        id: "s6",
        label: "Quality check required?",
        kind: "decision",
        route: "/purchasing/quality",
      },
      {
        id: "s7",
        label: "Post to stock",
        kind: "action",
        route: "/purchasing/goods-receipts",
        note: "Writes the lot, balance, ledger line and putaway task together",
      },
      {
        id: "s8",
        label: "Complete putaway into a bin",
        kind: "action",
        route: "/warehouse/putaway",
      },
      {
        id: "s9",
        label: "On the shelf",
        kind: "end",
        route: "/inventory/stock",
      },
    ],
  },
  {
    id: "flow:make",
    title: "Build a product",
    summary:
      "An active bill of materials is frozen on purpose — live jobs point at it.",
    category: "Operations",
    steps: [
      {
        id: "s1",
        label: "Create a bill of materials",
        kind: "start",
        route: "/bom",
      },
      {
        id: "s2",
        label: "Add components",
        kind: "action",
        route: "/bom",
        note: "Circular references are rejected before they save",
      },
      { id: "s3", label: "At least one component?", kind: "decision" },
      {
        id: "s4",
        label: "Activate — the structure freezes",
        kind: "action",
        route: "/bom",
      },
      {
        id: "s5",
        label: "Check build availability",
        kind: "action",
        route: "/materials/availability",
      },
      {
        id: "s6",
        label: "Create a production order",
        kind: "action",
        route: "/production",
      },
      {
        id: "s7",
        label: "Release — materials are reserved automatically",
        kind: "auto",
        route: "/production",
      },
      {
        id: "s8",
        label: "Issue parts against the requisition",
        kind: "action",
        route: "/materials/requisitions",
      },
      {
        id: "s9",
        label: "Book finished goods into stock",
        kind: "action",
        route: "/production",
      },
      {
        id: "s10",
        label: "Finished units on hand",
        kind: "end",
        route: "/inventory/stock",
      },
    ],
  },
  {
    id: "flow:schedule",
    title: "Schedule production onto machines",
    summary:
      "Work centres first, then a routing, then a date. Scheduling replaces rather than appends.",
    category: "Operations",
    steps: [
      {
        id: "s1",
        label: "Add work centres",
        kind: "start",
        route: "/planning/work-centers",
        note: "Real capacity accounts for efficiency and parallel stations",
      },
      {
        id: "s2",
        label: "Add routing steps to a bill of materials",
        kind: "action",
        route: "/bom",
        note: "Only possible while the BOM is not active",
      },
      {
        id: "s3",
        label: "Does the order's BOM have a routing?",
        kind: "decision",
        route: "/planning",
      },
      {
        id: "s4",
        label: "Schedule on the production board",
        kind: "action",
        route: "/planning",
      },
      {
        id: "s5",
        label: "Steps laid out with real dates",
        kind: "auto",
        note: "Replaces any previous schedule",
      },
      {
        id: "s6",
        label: "Any day over 100%?",
        kind: "decision",
        route: "/planning/capacity",
      },
      {
        id: "s7",
        label: "The plan fits",
        kind: "end",
        route: "/planning/capacity",
      },
    ],
  },
  {
    id: "flow:ship",
    title: "Pick, pack and dispatch",
    summary:
      "One requested line becomes one task per bin. You can only pack what was confirmed picked.",
    category: "Operations",
    steps: [
      {
        id: "s1",
        label: "Sales order confirmed",
        kind: "start",
        route: "/sales/orders",
      },
      {
        id: "s2",
        label: "Create a pick list",
        kind: "action",
        route: "/warehouse/pick-lists",
        note: "From a sales order, or ad-hoc lines",
      },
      {
        id: "s3",
        label: "Stock allocated across bins and reserved",
        kind: "auto",
        note: "FIFO, LIFO or FEFO — refused outright if there is not enough free stock",
      },
      {
        id: "s4",
        label: "Release, then pick in walking order",
        kind: "action",
        route: "/warehouse/pick-lists",
      },
      { id: "s5", label: "Everything picked?", kind: "decision" },
      {
        id: "s6",
        label: "Pack the confirmed quantities",
        kind: "action",
        route: "/warehouse/pick-lists",
      },
      {
        id: "s7",
        label: "Package awaiting dispatch",
        kind: "auto",
        route: "/warehouse/packages",
      },
      { id: "s8", label: "Shipped", kind: "end", route: "/warehouse/packages" },
    ],
  },
  {
    id: "flow:count",
    title: "Correct the stock figures",
    summary:
      "A count sheet is just notes until variances are posted. Posting is auditable.",
    category: "Operations",
    steps: [
      {
        id: "s1",
        label: "Start a count",
        kind: "start",
        route: "/inventory/counts",
      },
      {
        id: "s2",
        label: "Enter what was physically found",
        kind: "action",
        route: "/inventory/counts",
      },
      { id: "s3", label: "Variances calculated", kind: "auto" },
      {
        id: "s4",
        label: "Post variances to stock",
        kind: "action",
        route: "/inventory/counts",
        note: "Writes gain and loss movements",
      },
      {
        id: "s5",
        label: "Visible in the ledger",
        kind: "end",
        route: "/inventory/movements",
      },
    ],
  },
  {
    id: "flow:money",
    title: "Invoice and settle",
    summary:
      "Invoices are never typed from scratch. Balances follow allocations, never the other way round.",
    category: "Finance",
    steps: [
      {
        id: "s1",
        label: "Goods received, or an order shipped",
        kind: "start",
      },
      {
        id: "s2",
        label: "Raise a supplier invoice from a received order",
        kind: "action",
        route: "/finance/payables",
      },
      {
        id: "s3",
        label: "Approve it for payment",
        kind: "action",
        route: "/finance/payables",
      },
      {
        id: "s4",
        label: "Raise a customer invoice from a shipped order",
        kind: "action",
        route: "/finance/receivables",
      },
      {
        id: "s5",
        label: "Record the payment",
        kind: "action",
        route: "/finance/payments",
        note: "Currencies must match, and you cannot pay more than is outstanding",
      },
      {
        id: "s6",
        label: "Balance and status recomputed from allocations",
        kind: "auto",
      },
      {
        id: "s7",
        label: "Settled",
        kind: "end",
        route: "/finance",
      },
    ],
  },
  {
    id: "flow:access",
    title: "Give someone access",
    summary:
      "Roles decide the default; CUSTOM users get only what is explicitly granted.",
    category: "Admin",
    steps: [
      {
        id: "s1",
        label: "Create the user",
        kind: "start",
        route: "/admin/user-management",
        adminOnly: true,
      },
      {
        id: "s2",
        label: "Pick a role — ADMIN, SALES or CUSTOM",
        kind: "action",
        route: "/admin/user-management",
        adminOnly: true,
      },
      {
        id: "s3",
        label: "Grant named capabilities for CUSTOM",
        kind: "action",
        route: "/admin/user-management",
        adminOnly: true,
      },
      {
        id: "s4",
        label: "Credentials emailed automatically",
        kind: "auto",
      },
      {
        id: "s5",
        label: "They set a password and choose a second factor",
        kind: "action",
        route: "/login",
      },
      {
        id: "s6",
        label: "Navigation and API both filtered to those capabilities",
        kind: "end",
      },
    ],
  },
  {
    id: "flow:security",
    title: "Settings and account security",
    summary:
      "Your own sign-in methods, plus the workspace-wide settings other modules read.",
    category: "Admin",
    steps: [
      { id: "s1", label: "Settings", kind: "start", route: "/settings" },
      {
        id: "s2",
        label: "Your account — change your password",
        kind: "action",
        route: "/settings",
      },
      {
        id: "s3",
        label: "Security — turn sign-in methods on or off",
        kind: "action",
        route: "/settings",
        note: "Password, email code, authenticator app",
      },
      {
        id: "s4",
        label: "Is it the last method on the account?",
        kind: "decision",
        note: "The last one cannot be turned off — set another up first",
      },
      {
        id: "s5",
        label:
          "Workspace — currency, locale and the manager approval threshold",
        kind: "action",
        route: "/settings",
        note: "The threshold decides which quotes need approval",
      },
      {
        id: "s6",
        label: "Choose which alerts you receive",
        kind: "action",
        route: "/admin/notifications",
      },
      { id: "s7", label: "Account and workspace configured", kind: "end" },
    ],
  },
  {
    id: "flow:import-export",
    title: "Import and export records",
    summary:
      "Most list screens export what you are looking at; importing needs the data.import capability.",
    category: "Admin",
    steps: [
      {
        id: "s1",
        label: "Open a list screen",
        kind: "start",
        route: "/leads/lead-master",
      },
      { id: "s2", label: "Importing or exporting?", kind: "decision" },
      {
        id: "s3",
        label: "Download the template, fill it, upload it",
        kind: "action",
        route: "/leads/lead-master",
        note: "Requires the data.import capability",
      },
      {
        id: "s4",
        label: "Filter the view, then export it",
        kind: "action",
        note: "Exports exactly what is on screen",
      },
      { id: "s5", label: "Records in, or a file out", kind: "end" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const ARCH_NODE_BY_ID = new Map(ARCH_NODES.map(node => [node.id, node]));

export function childrenOf(parentId: string | null): ArchNode[] {
  return ARCH_NODES.filter(node => node.parent === parentId);
}

/** Walks up to the module so search can expand the right branch. */
export function ancestorsOf(nodeId: string): string[] {
  const chain: string[] = [];
  let current = ARCH_NODE_BY_ID.get(nodeId);
  while (current?.parent) {
    chain.push(current.parent);
    current = ARCH_NODE_BY_ID.get(current.parent);
  }
  return chain;
}

export function isNavigable(node: ArchNode): boolean {
  return Boolean(node.route);
}
