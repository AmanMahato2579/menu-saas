import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string | null })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;

  const tableSession = await prisma.tableSession.findFirst({
    where: { id: sessionId, restaurantId },
  });

  if (!tableSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Update table session to CLOSED
  await prisma.tableSession.update({
    where: { id: sessionId },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  // Automatically mark any remaining running orders in this session as COMPLETED
  await prisma.order.updateMany({
    where: {
      tableSessionId: sessionId,
      status: { notIn: ["COMPLETED", "REJECTED"] },
    },
    data: { status: "COMPLETED" },
  });

  return NextResponse.json({ success: true });
}
