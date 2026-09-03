import { Express } from "express";
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

export function setupRoutes(app: Express) {
  app.get("/health", async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", database: "connected" });
    } catch {
      res.status(500).json({
        status: "error",
        database: "disconnected",
      });
    }
  });

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
