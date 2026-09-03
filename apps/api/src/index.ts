import { assertRequiredEnvironment, serverPort } from "./config/environment.js";
import { createApp } from "./app.js";
import { setupRoutes } from "./routes/index.js";
import { prisma } from "@repo/db";
import { startWhatsappScheduler } from "./jobs/whatsapp-scheduler.js";
import { startInventorySchedulers } from "./jobs/inventory-scheduler.js";
import { startFinanceSchedulers } from "./jobs/finance-scheduler.js";
import { embeddedSchedulersEnabled } from "./jobs/scheduler-lease.js";
import { logError, logInfo } from "./utils/logger.js";

assertRequiredEnvironment();

const app = createApp();
const port = serverPort();

setupRoutes(app);

const server = app.listen(port, () => {
  logInfo("api_server_started", { port });
  if (embeddedSchedulersEnabled()) {
    logInfo("embedded_schedulers_enabled");
    startWhatsappScheduler();
    startInventorySchedulers();
    startFinanceSchedulers();
  } else {
    logInfo("embedded_schedulers_disabled");
  }
});
server.on("error", error => {
  logError("api_server_error", error, { port });
  void prisma.$disconnect().finally(() => process.exit(1));
});

let shuttingDown = false;
async function shutdown(signal: "SIGINT" | "SIGTERM"): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logInfo("api_server_shutdown_started", { signal });
  const forceTimer = setTimeout(() => {
    logError("api_server_shutdown_timeout", new Error("Shutdown timed out"), {
      signal,
    });
    process.exit(1);
  }, 10_000);
  forceTimer.unref();
  server.close(async error => {
    clearTimeout(forceTimer);
    try {
      await prisma.$disconnect();
    } finally {
      if (error) {
        logError("api_server_shutdown_failed", error, { signal });
        process.exit(1);
      }
      process.exit(0);
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
