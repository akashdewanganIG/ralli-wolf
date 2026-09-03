import { prisma } from "@repo/db";
import { evaluateStockAlerts } from "../services/supplyChain/reorder.service.js";
import { snapshotSupplierPerformance } from "../services/supplyChain/supplier-performance.service.js";
import { ReservationStatus } from "@prisma/client";
import { releaseReservations } from "../services/supplyChain/stock.service.js";
import { runWithSchedulerLease } from "./scheduler-lease.js";
import { logError, logInfo } from "../utils/logger.js";

const INVENTORY_ALERT_INTERVAL_MS = 15 * 60_000;
const RESERVATION_SWEEP_INTERVAL_MS = 60 * 60_000;
const SUPPLIER_SNAPSHOT_INTERVAL_MS = 24 * 60 * 60_000;

let alertRunInFlight = false;

export async function runStockAlertEvaluation(): Promise<void> {
  if (alertRunInFlight) {
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
      logInfo("inventory_alert_sweep_completed", {
        evaluatedRules: summary.evaluatedRules,
        raised: summary.raised,
        resolved: summary.resolved,
        requisitionsCreated: summary.requisitionsCreated,
      });
    }
  } catch (error) {
    logError("inventory_alert_sweep_failed", error);
  } finally {
    alertRunInFlight = false;
  }
}

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

    logInfo("expired_reservations_released", { count: expired.length });
  } catch (error) {
    logError("expired_reservation_release_failed", error);
  }
}

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
      logInfo("supplier_performance_snapshot_completed", {
        supplierCount: suppliers.length,
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
      });
    }
  } catch (error) {
    logError("supplier_performance_snapshot_failed", error);
  }
}

export function startInventorySchedulers(): Array<NodeJS.Timeout> {
  logInfo("inventory_schedulers_started", {
    alertIntervalMs: INVENTORY_ALERT_INTERVAL_MS,
    reservationIntervalMs: RESERVATION_SWEEP_INTERVAL_MS,
    supplierSnapshotIntervalMs: SUPPLIER_SNAPSHOT_INTERVAL_MS,
  });

  const runAlerts = () =>
    runWithSchedulerLease(
      "inventory-alerts",
      Math.max(INVENTORY_ALERT_INTERVAL_MS * 2, 30 * 60_000),
      runStockAlertEvaluation
    ).catch(error => logError("inventory_scheduler_lease_failed", error));
  const runReservations = () =>
    runWithSchedulerLease(
      "expired-reservations",
      Math.max(RESERVATION_SWEEP_INTERVAL_MS * 2, 30 * 60_000),
      releaseExpiredReservations
    ).catch(error => logError("reservation_scheduler_lease_failed", error));
  const runSupplierSnapshot = () =>
    runWithSchedulerLease(
      "supplier-monthly-snapshot",
      2 * 60 * 60_000,
      snapshotMonthlySupplierPerformance
    ).catch(error =>
      logError("supplier_snapshot_scheduler_lease_failed", error)
    );

  void runAlerts();
  void runReservations();
  void runSupplierSnapshot();
  const timers = [
    setInterval(() => void runAlerts(), INVENTORY_ALERT_INTERVAL_MS),
    setInterval(() => void runReservations(), RESERVATION_SWEEP_INTERVAL_MS),
    setInterval(
      () => void runSupplierSnapshot(),
      SUPPLIER_SNAPSHOT_INTERVAL_MS
    ),
  ];

  for (const timer of timers) timer.unref();
  return timers;
}
