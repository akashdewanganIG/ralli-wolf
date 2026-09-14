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
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return null;
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
  :root {
    color-scheme:light dark;
    --bg:#f1f1f1;
    --surface:#fff;
    --surface-subtle:#f5f5f5;
    --fg:#171717;
    --muted:#737373;
    --line:#d6d6d6;
    --line-subtle:#e5e5e5;
    --primary:#ed1c24;
    --primary-hover:#c5101b;
    --primary-on:#fff;
    --primary-surface:#fef2f2;
    --primary-line:#fecaca;
    --ok:#15803d;
    --okbg:#f0fdf4;
    --okline:#bbf7d0;
    --warn:#b45309;
    --warnbg:#fffbeb;
    --warnline:#fde68a;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#0f0f0f;
      --surface:#1a1a1a;
      --surface-subtle:#1f1f1f;
      --fg:#fafafa;
      --muted:#8a8a8a;
      --line:#2b2b2b;
      --line-subtle:#232323;
      --primary:#f5252d;
      --primary-hover:#ff3d44;
      --primary-surface:#2a1215;
      --primary-line:#4d1f23;
      --ok:#86efac;
      --okbg:#10251a;
      --okline:#1f4430;
      --warn:#fcd34d;
      --warnbg:#2a1f08;
      --warnline:#4d3a10;
    }
  }
  * { box-sizing:border-box; }
  body {
    margin:0;
    min-height:100vh;
    background:var(--bg);
    color:var(--fg);
    font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  }
  .page { width:min(100%,72rem); margin:0 auto; padding:28px 24px; }
  .brand { display:flex; align-items:center; gap:10px; width:max-content; color:var(--fg); text-decoration:none; }
  .brand-mark { display:grid; place-items:center; width:30px; height:30px; border-radius:8px; background:var(--primary); color:#fff;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 -1px 0 rgba(0,0,0,.18),0 3px 8px -2px rgba(0,0,0,.2); }
  .brand-mark svg { width:17px; height:17px; }
  .brand-copy { display:flex; flex-direction:column; line-height:1.05; }
  .brand-name { font-size:13px; font-weight:800; letter-spacing:.08em; }
  .brand-product { margin-top:4px; color:var(--muted); font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; }
  .card { margin-top:52px; overflow:hidden; background:var(--surface); border:1px solid var(--line); border-radius:16px;
          box-shadow:0 1px 2px rgba(16,24,40,.05),0 18px 50px -24px rgba(16,24,40,.24); }
  .hero { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; padding:32px; }
  .eyebrow { margin:0 0 8px; color:var(--primary); font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
  h1 { margin:0; max-width:34rem; font-size:clamp(24px,4vw,36px); line-height:1.12; letter-spacing:-.035em; }
  .detail { margin:10px 0 0; color:var(--muted); font-size:13px; }
  .badge { display:inline-flex; flex:none; align-items:center; gap:7px; padding:6px 10px; border:1px solid var(--okline); border-radius:999px;
           color:var(--ok); background:var(--okbg); font-size:11px; font-weight:700; white-space:nowrap; }
  .badge.warn { color:var(--warn); background:var(--warnbg); border-color:var(--warnline); }
  .dot { width:7px; height:7px; border-radius:50%; background:currentColor; }
  .status-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1px; margin:0; padding:1px 0 0; background:var(--line-subtle); border-top:1px solid var(--line-subtle); }
  .status-item { min-width:0; padding:20px 24px; background:var(--surface); }
  dt { color:var(--muted); font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; }
  dd { margin:7px 0 0; overflow-wrap:anywhere; font-size:13px; font-weight:600; }
  .actions { display:flex; align-items:center; justify-content:space-between; gap:20px; padding:18px 24px; border-top:1px solid var(--line-subtle); background:var(--surface-subtle); }
  .note { margin:0; color:var(--muted); font-size:12px; }
  a.back { flex:none; display:inline-flex; align-items:center; justify-content:center; min-height:40px; padding:10px 16px; border:1px solid rgba(197,16,27,.8);
           border-radius:8px; background:var(--primary); color:var(--primary-on); text-decoration:none; font-size:13px; font-weight:700;
           box-shadow:inset 0 1px 0 rgba(255,255,255,.25),inset 0 -1px 0 rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.16),0 3px 8px -2px rgba(0,0,0,.18); }
  a.back:hover { background:var(--primary-hover); }
  a.back:focus-visible { outline:3px solid var(--primary-line); outline-offset:2px; }
  .footer { margin:18px 0 0; color:var(--muted); font-size:11px; text-align:center; }
  @media (max-width:640px) {
    .page { padding:20px 16px; }
    .card { margin-top:32px; }
    .hero { flex-direction:column-reverse; padding:24px 20px; }
    .status-grid { grid-template-columns:1fr; }
    .status-item { padding:16px 20px; }
    .actions { align-items:stretch; flex-direction:column; padding:18px 20px; }
    a.back { width:100%; }
  }
</style>
</head>
<body>
  <div class="page">
    <a class="brand" ${appOrigin ? `href="${escapeHtml(appOrigin)}"` : 'href="/"'} aria-label="Ralli Wolf Operations">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M6 5h12v4H9.5v2H17v4H9.5v4H6V5Z" fill="currentColor"/></svg>
      </span>
      <span class="brand-copy"><span class="brand-name">RALLI WOLF</span><span class="brand-product">Operations</span></span>
    </a>

    <main class="card">
      <section class="hero">
        <div>
          <p class="eyebrow">Infrastructure status</p>
          <h1>${databaseReachable ? "API server is ready" : "API server needs attention"}</h1>
          <p class="detail">${escapeHtml(state.detail)}</p>
        </div>
        <span class="badge${state.tone === "warn" ? " warn" : ""}"><span class="dot"></span>${escapeHtml(state.label)}</span>
      </section>

      <dl class="status-grid">
        <div class="status-item"><dt>API service</dt><dd>Online</dd></div>
        <div class="status-item"><dt>Database</dt><dd>${databaseReachable ? "Connected" : "Unreachable"}</dd></div>
        <div class="status-item"><dt>Last checked</dt><dd>${escapeHtml(new Date().toUTCString())}</dd></div>
      </dl>

      <section class="actions">
        <p class="note">The server is awake. You can safely return to the application.</p>
        ${appOrigin ? `<a class="back" href="${escapeHtml(appOrigin)}">Return to Ralli Wolf</a>` : ""}
      </section>
    </main>
    <p class="footer">Ralli Wolf Operations · Secure API status</p>
  </div>
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
