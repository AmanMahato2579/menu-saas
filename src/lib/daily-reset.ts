import { prisma } from "@/lib/prisma";
import { startOfBusinessDay, ORDER_HISTORY_RETENTION_HOURS } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DailyResetResult {
  staleSessionsClosed: number;
  oldSessionsDeleted: number;
  ordersDeleted: number;
  notificationsDeleted: number;
  bookingsDeleted: number;
}

/**
 * Nightly data reset, meant to run just after midnight in the restaurant
 * timezone (Asia/Kathmandu). Keeps only restaurant details/menu/config:
 * orders, sessions, and notifications are ephemeral day-scoped data.
 *
 * Steps (each best-effort; counts reported in the result):
 *  1. Close ACTIVE table sessions left open from a previous business day.
 *  2. Delete COMPLETED / REJECTED orders past the 24h retention window.
 *  3. Delete notifications from before the current business day.
 *  4. Delete bookings finished (or dropped) before the retention window.
 *  5. Best-effort purge of CLOSED sessions older than 30 days.
 */
export async function runDailyReset(): Promise<DailyResetResult> {
  const businessDayStart = startOfBusinessDay();
  const retentionCutoff = new Date(Date.now() - ORDER_HISTORY_RETENTION_HOURS * 60 * 60 * 1000);
  const sessionCutoff = new Date(Date.now() - 30 * DAY_MS);

  const [staleSessionCount] = await prisma.$transaction([
    prisma.tableSession.count({ where: { status: "ACTIVE", startedAt: { lt: businessDayStart } } }),
  ]);

  const staleSessions = await prisma.tableSession.updateMany({
    where: { status: "ACTIVE", startedAt: { lt: businessDayStart } },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  const orders = await prisma.order.deleteMany({
    where: { status: { in: ["COMPLETED", "REJECTED"] }, statusChangedAt: { lt: retentionCutoff } },
  });

  const notifications = await prisma.notification.deleteMany({
    where: { createdAt: { lt: businessDayStart } },
  });

  const bookings = await prisma.booking.deleteMany({
    where: { status: { in: ["COMPLETED", "REJECTED", "CANCELLED"] }, createdAt: { lt: retentionCutoff } },
  });

  let oldSessionsDeleted = 0;
  try {
    const oldSessions = await prisma.tableSession.deleteMany({
      where: { status: "CLOSED", closedAt: { lt: sessionCutoff } },
    });
    oldSessionsDeleted = oldSessions.count;
  } catch {
    // Orders / bookings may still reference a session through non-cascade
    // relations; a purge failure is never fatal for the reset.
    oldSessionsDeleted = -1;
  }

  console.log(
    `[daily-reset] staleSessions=${staleSessionCount} closed=${staleSessions.count} orders=${orders.count} notifications=${notifications.count} bookings=${bookings.count}`
  );

  return {
    staleSessionsClosed: staleSessions.count,
    oldSessionsDeleted,
    ordersDeleted: orders.count,
    notificationsDeleted: notifications.count,
    bookingsDeleted: bookings.count,
  };
}
