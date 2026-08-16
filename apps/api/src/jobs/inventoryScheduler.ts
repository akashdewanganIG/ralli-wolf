import { prisma } from "@repo/db";
import { evaluateStockAlerts } from "../services/supplyChain/reorder.service.js";
import { snapshotSupplierPerformance } from "../services/supplyChain/supplierPerformance.service.js";
import { ReservationStatus } from "@prisma/client";
import { releaseReservations } from "../services/supplyChain/stock.service.js";

let alertRunInFlight = false;

/**
 * Re-evaluate every reorder rule and expiry window.
 *
 * The engine is idempotent, so a run that overlaps a manual evaluation is
 * harmless; the in-flight guard exists only to stop a slow run from stacking
 * up behind itself on a large catalogue.
 */
export async function runStockAlertEvaluation(): Promise<void> {
  if (alertRunInFlight) {
    console.log(
      "[Inventory] Previous alert evaluation still running; skipping this tick"
    );
    return;
  }

  alertRunInFlight = true;
  try {
    const summary = await evaluateStockAlerts({ notify: true });
    if (
      summary.raised > 0 ||
      summary.resolved > 0 ||
      summary.requisitionsCreated > 0
    ) {
      console.log(
        `[Inventory] Alert sweep: ${summary.evaluatedRules} rule(s) evaluated, ${summary.raised} raised, ${summary.resolved} resolved, ${summary.requisitionsCreated} requisition(s) created`
      );
    }
  } catch (error) {
    console.error("[Inventory] Alert evaluation failed:", error);
  } finally {
    alertRunInFlight = false;
  }
}

/**
 * Hand back stock held by reservations that have passed their expiry, so a
 * cancelled or forgotten demand document does not keep inventory locked out
 * of everyone else's reach forever.
 */
export async function releaseExpiredReservations(): Promise<void> {
  try {
    const expired = await prisma.stockReservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: { not: null, lte: new Date() },
      },
      select: { id: true, referenceType: true, referenceId: true },
    });

    if (expired.length === 0) return;

    for (const reservation of expired) {
      await prisma.$transaction(tx =>
        releaseReservations(tx, {
          referenceType: reservation.referenceType,
          referenceId: reservation.referenceId,
          reservationId: reservation.id,
        })
      );
    }

    console.log(
      `[Inventory] Released ${expired.length} expired reservation(s)`
    );
  } catch (error) {
    console.error("[Inventory] Failed to release expired reservations:", error);
  }
}

/**
 * Snapshot each active supplier's KPIs for the month that just closed, so the
 * scorecard trend has a fixed history rather than being recomputed from a
 * moving window every time it is viewed.
 */
export async function snapshotMonthlySupplierPerformance(
  now: Date = new Date()
): Promise<void> {
  try {
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0)
    );
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0) - 1000
    );

    const suppliers = await prisma.supplier.findMany({
      where: { status: { in: ["ACTIVE", "ON_HOLD"] } },
      select: { id: true },
    });

    for (const supplier of suppliers) {
      await snapshotSupplierPerformance(supplier.id, periodStart, periodEnd);
    }

    if (suppliers.length > 0) {
      console.log(
        `[Procurement] Snapshotted performance for ${suppliers.length} supplier(s) covering ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`
      );
    }
  } catch (error) {
    console.error("[Procurement] Supplier performance snapshot failed:", error);
  }
}

/**
 * Start the in-process supply-chain schedulers.
 *
 * Intervals are configurable because the right cadence depends on catalogue
 * size: a few hundred SKUs can be swept every fifteen minutes, tens of
 * thousands should not be.
 */
export function startInventorySchedulers(): Array<NodeJS.Timeout> {
  const alertIntervalMs =
    Number(process.env.INVENTORY_ALERT_INTERVAL_MS || "") || 15 * 60_000;
  const reservationIntervalMs =
    Number(process.env.RESERVATION_SWEEP_INTERVAL_MS || "") || 60 * 60_000;

  console.log(
    `[Inventory] Reorder alert sweep every ${Math.round(alertIntervalMs / 60_000)} min (INVENTORY_ALERT_INTERVAL_MS), reservation sweep every ${Math.round(reservationIntervalMs / 60_000)} min`
  );

  const timers = [
    setInterval(() => void runStockAlertEvaluation(), alertIntervalMs),
    setInterval(() => void releaseExpiredReservations(), reservationIntervalMs),
  ];

  for (const timer of timers) timer.unref();
  return timers;
}
