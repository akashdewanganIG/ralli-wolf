import { Express, type RequestHandler } from "express";
import { prisma } from "@repo/db";
import authRoutes from "./auth.routes.js";
import userRoutes from "./users.routes.js";
import leadRoutes from "./leads.routes.js";
import contactRoutes from "./contacts.routes.js";
import campaignRoutes from "./campaigns.routes.js";
import analyticsRoutes from "./analytics.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import webhookRoutes from "./webhooks.routes.js";
import brevoRoutes from "./brevo.routes.js";
import integrationsRoutes from "./integrations.routes.js";
import whatsappRoutes from "./whatsapp.routes.js";
import accountRoutes from "./accounts.routes.js";
import exportRoutes from "./exports.routes.js";
import salesRoutes from "./sales.routes.js";
import subdealerRoutes from "./subdealer.routes.js";
import productRoutes from "./product.routes.js";
import productCategoryRoutes from "./product-category.routes.js";
import keywordRoutes from "./keywords.routes.js";
import segmentRoutes from "./segments.routes.js";
import invoiceRoutes from "./invoice.routes.js";
import landingPageCampaignRoutes from "./landing-page-campaign.routes.js";
import orderRoutes from "./order.routes.js";
import aakramanRoutes from "./aakraman.routes.js";
import pricebookRoutes from "./pricebook.routes.js";
import pricebookEntryRoutes from "./pricebook-entry.routes.js";
import settingsRoutes from "./settings.routes.js";
import opportunityRoutes from "./opportunity.routes.js";
import quoteRoutes from "./quote.routes.js";
import salesOrderRoutes from "./sales-order.routes.js";
import approvalRoutes from "./approval.routes.js";
import notificationRoutes from "./notification.routes.js";
import { financeRouter, planningRouter } from "./finance.routes.js";
import { dataTransferRouter } from "./data-transfer.routes.js";
import {
  warehouseRouter,
  inventoryRouter,
  materialRouter,
  wmsRouter,
  bomRouter,
  supplierRouter,
  purchaseRequisitionRouter,
  purchaseOrderRouter,
  goodsReceiptRouter,
  productionRouter,
} from "./supply-chain.routes.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only a well-formed http(s) origin is worth turning into a link. */
function frontendOrigin(): string | null {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function statusPage(databaseReachable: boolean, appOrigin: string | null) {
  const state = databaseReachable
    ? { tone: "ok", label: "Running", detail: "Database connected" }
    : {
        tone: "warn",
        label: "Running",
        detail: "Database unreachable — sign-in will fail",
      };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Ralli Wolf API</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f7f9; --card:#fff; --fg:#11181c; --muted:#5f6b76; --line:#e3e8ef; --ok:#0f7b3f; --okbg:#e7f6ed; --warn:#8a5a00; --warnbg:#fdf3e0; --accent:#11181c; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0e1216; --card:#161b22; --fg:#e6edf3; --muted:#9aa7b2; --line:#242c36; --ok:#4ade80; --okbg:#0f2a1b; --warn:#fbbf24; --warnbg:#2b2010; --accent:#e6edf3; }
  }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;
         background:var(--bg); color:var(--fg);
         font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .card { width:100%; max-width:26rem; background:var(--card); border:1px solid var(--line);
          border-radius:14px; padding:28px; box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -12px rgba(16,24,40,.14); }
  .badge { display:inline-flex; align-items:center; gap:7px; padding:5px 11px; border-radius:999px;
           font-size:12.5px; font-weight:600; letter-spacing:.01em;
           color:var(--ok); background:var(--okbg); }
  .badge.warn { color:var(--warn); background:var(--warnbg); }
  .dot { width:7px; height:7px; border-radius:50%; background:currentColor; }
  h1 { margin:18px 0 6px; font-size:21px; letter-spacing:-.015em; }
  p { margin:0; color:var(--muted); font-size:13.5px; }
  dl { margin:22px 0 0; border-top:1px solid var(--line); }
  .row { display:flex; justify-content:space-between; gap:16px; padding:11px 0; border-bottom:1px solid var(--line); }
  dt { color:var(--muted); font-size:13px; }
  dd { margin:0; font-size:13px; font-weight:500; text-align:right; }
  a.back { display:block; margin-top:24px; padding:11px 16px; border-radius:9px; text-align:center;
           background:var(--accent); color:var(--card); text-decoration:none; font-weight:600; font-size:14px; }
  .note { margin-top:14px; text-align:center; font-size:12.5px; color:var(--muted); }
</style>
</head>
<body>
  <main class="card">
    <span class="badge${state.tone === "warn" ? " warn" : ""}"><span class="dot"></span>${escapeHtml(state.label)}</span>
    <h1>Ralli Wolf API</h1>
    <p>${escapeHtml(state.detail)}</p>
    <dl>
      <div class="row"><dt>Service</dt><dd>Online</dd></div>
      <div class="row"><dt>Database</dt><dd>${databaseReachable ? "Connected" : "Unreachable"}</dd></div>
      <div class="row"><dt>Checked</dt><dd>${escapeHtml(new Date().toUTCString())}</dd></div>
    </dl>
    ${
      appOrigin
        ? `<a class="back" href="${escapeHtml(appOrigin)}">Back to Ralli Wolf</a>
    <p class="note">The server is awake. You can close this tab and sign in.</p>`
        : `<p class="note" style="margin-top:24px">The server is awake. You can close this tab and return to the app.</p>`
    }
  </main>
</body>
</html>`;
}

export function setupRoutes(app: Express) {
  /*
   * Opening the API host directly used to land on Express's "Cannot GET /",
   * which reads like a broken deployment. The web app now sends people here to
   * wake a sleeping instance, so the root has to answer the only question they
   * have: is it up, and can I go back?
   */
  const statusPageHandler: RequestHandler = async (_req, res) => {
    let databaseReachable = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseReachable = false;
    }
    // The global policy is default-src 'none', which would drop the inline
    // stylesheet; widen it for this one HTML response only.
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
    );
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(statusPage(databaseReachable, frontendOrigin()));
  };

  app.get("/", statusPageHandler);

  const healthHandler: RequestHandler = async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", database: "connected" });
    } catch {
      res.status(500).json({
        status: "error",
        database: "disconnected",
      });
    }
  };

  app.get(["/health", "/api/health"], healthHandler);

  app.get("/healthz", (req, res) => {
    const token = process.env.KEEPALIVE_TOKEN;
    if (token && req.get("x-keepalive-token") !== token) {
      return res.status(401).send("unauthorized");
    }
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.set("Surrogate-Control", "no-store");
    res.set("Pragma", "no-cache");
    return res.status(200).send("ok");
  });

  app.use("/api/auth", authRoutes);

  app.use("/api/subdealer", subdealerRoutes);

  app.use("/api/aakraman", aakramanRoutes);

  app.use("/api/products", productRoutes);
  app.use("/api/product-categories", productCategoryRoutes);
  app.use("/api/keywords", keywordRoutes);

  app.use("/api/invoices", invoiceRoutes);

  app.use("/api/orders", orderRoutes);

  app.use("/api/users", userRoutes);
  app.use("/api/leads", leadRoutes);
  app.use("/api/contacts", contactRoutes);
  app.use("/api/segments", segmentRoutes);
  app.use("/api/campaigns", campaignRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/brevo", brevoRoutes);
  app.use("/api/whatsapp", whatsappRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/accounts", accountRoutes);
  app.use("/api/integrations", integrationsRoutes);
  app.use("/api/export", exportRoutes);
  app.use("/api/sales", salesRoutes);
  app.use("/api/landing-page-campaigns", landingPageCampaignRoutes);
  app.use("/api/pricebooks", pricebookRoutes);
  app.use("/api/pricebook-entries", pricebookEntryRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/opportunities", opportunityRoutes);
  app.use("/api/quotes", quoteRoutes);
  app.use("/api/sales-orders", salesOrderRoutes);
  app.use("/api/approvals", approvalRoutes);
  app.use("/api/notifications", notificationRoutes);

  app.use("/api/finance", financeRouter);
  app.use("/api/planning", planningRouter);

  app.use("/api/data", dataTransferRouter);

  app.use("/api/warehouses", warehouseRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/materials", materialRouter);
  app.use("/api/wms", wmsRouter);
  app.use("/api/boms", bomRouter);
  app.use("/api/suppliers", supplierRouter);
  app.use("/api/purchase-requisitions", purchaseRequisitionRouter);
  app.use("/api/purchase-orders", purchaseOrderRouter);
  app.use("/api/goods-receipts", goodsReceiptRouter);
  app.use("/api/production-orders", productionRouter);

  app.use("/api/webhook", webhookRoutes);
}
