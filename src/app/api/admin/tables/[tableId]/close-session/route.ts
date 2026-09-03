import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string | null })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tableId } = await params;

  // Find all active session IDs for this table
  const activeSessions = await prisma.tableSession.findMany({
    where: { tableId, restaurantId, status: "ACTIVE" },
    select: { id: true },
  });
  const sessionIds = activeSessions.map((s) => s.id);

  // Close all active sessions for this table
  await prisma.tableSession.updateMany({
    where: { tableId, restaurantId, status: "ACTIVE" },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  // Mark all orders in these sessions as COMPLETED
  if (sessionIds.length > 0) {
    await prisma.order.updateMany({
      where: {
        tableSessionId: { in: sessionIds },
        status: { notIn: ["COMPLETED", "REJECTED"] },
      },
      data: { status: "COMPLETED" },
    });
  }

  return NextResponse.json({ success: true });
}
