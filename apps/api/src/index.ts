import { createApp } from "./app.js";
import { setupRoutes } from "./routes/index.js";
import { prisma } from "@repo/db";
import { processScheduledWhatsappCampaigns } from "./jobs/whatsappScheduler.js";
import { startInventorySchedulers } from "./jobs/inventoryScheduler.js";

const app = createApp();
const PORT = process.env.PORT || 4000;

// Setup all routes
setupRoutes(app);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);

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
