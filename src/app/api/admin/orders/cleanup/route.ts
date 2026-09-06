import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfBusinessDay } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * On-demand physical cleanup of expired COMPLETED/REJECTED order history for
 * the authenticated restaurant. This is NOT called automatically by the client
 * on every view — it is an administrative maintenance endpoint that can be
 * invoked by a scheduled job/cron (e.g. once per night) or manually. Query
 * filtering already keeps old history out of every request, so this only frees
 * disk space; it never affects the UI.
 *
 * Scoped to the authenticated restaurant to guarantee tenant isolation.
 */
export async function POST() {
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
  if (!restaurantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = startOfBusinessDay();
    const result = await prisma.order.deleteMany({
      where: {
        restaurantId,
        statusChangedAt: { lt: cutoff },
        status: { in: ["COMPLETED", "REJECTED"] },
      },
    });
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("[Order Cleanup Error]:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
