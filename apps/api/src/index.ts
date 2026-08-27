import { assertRequiredEnvironment } from "./config/environment.js";
import { createApp } from "./app.js";
import { setupRoutes } from "./routes/index.js";
import { prisma } from "@repo/db";
import { processScheduledWhatsappCampaigns } from "./jobs/whatsappScheduler.js";
import { startInventorySchedulers } from "./jobs/inventoryScheduler.js";
import { startFinanceSchedulers } from "./jobs/financeScheduler.js";

// Before anything binds a port or opens a connection: a service that cannot
// sign a token or deliver a sign-in code should fail the deploy, not the user.
assertRequiredEnvironment();

const app = createApp();
const PORT = process.env.PORT || 4000;

// Setup all routes
setupRoutes(app);

// Start server
app.listen(PORT, () => {
  // Report the address the service is actually reachable at. Printing
  // `localhost` on a deployed instance is misleading in the logs, so the
  // public origin is used whenever it is configured.
  const publicUrl = (
    process.env.API_PUBLIC_URL?.trim() || `http://localhost:${PORT}`
  ).replace(/\/+$/, "");
  console.log(`🚀 API server listening on port ${PORT} (${publicUrl})`);
  console.log(`📊 Health check: ${publicUrl}/health`);

  // Lightweight in-process scheduler for WhatsApp campaigns.
  // Runs once per minute; adjust interval via WHATSAPP_SCHEDULER_INTERVAL_MS if needed.
  const intervalMs =
    Number(process.env.WHATSAPP_SCHEDULER_INTERVAL_MS || "") || 60_000;

  console.log(
    `🕒 WhatsApp scheduler running every ${Math.round(
      intervalMs / 1000
    )}s (set WHATSAPP_SCHEDULER_INTERVAL_MS to change)`
  );

  const timer = setInterval(() => {
    // Fire-and-forget; errors are logged inside the job.
    void processScheduledWhatsappCampaigns();
  }, intervalMs);

  // Ensure the interval does not keep Node.js from exiting on shutdown.
  timer.unref();

  // Supply-chain schedulers: reorder alert sweep and reservation expiry.
  startInventorySchedulers();

  // Ledger sweep: one digest a day of everything past its due date.
  startFinanceSchedulers();
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("🛑 Shutting down server...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🛑 Shutting down server...");
  await prisma.$disconnect();
  process.exit(0);
});
