import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getRestaurantId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tableId } = await params;
  const table = await prisma.table.findFirst({ where: { id: tableId, restaurantId } });
  if (!table) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.table.delete({ where: { id: tableId } });
  return NextResponse.json({ success: true });
}
