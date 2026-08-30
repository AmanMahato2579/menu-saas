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

  // Close all active sessions for this table
  await prisma.tableSession.updateMany({
    where: { tableId, restaurantId, status: "ACTIVE" },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
