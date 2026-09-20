import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { startTableSession } from "@/lib/db";
import { loadOperationalRestaurant, getEffectiveAccess, canOrder } from "@/lib/plans";

const bodySchema = z.object({ customerName: z.string().trim().max(80).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ tableToken: string }> }) {
  const { tableToken } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  const table = await prisma.table.findFirst({ where: { qrToken: tableToken, isActive: true, restaurant: { isActive: true } } });
  if (!table) return NextResponse.json({ error: "Table is unavailable" }, { status: 404 });

  const restaurant = await loadOperationalRestaurant(table.restaurantId);
  if (!restaurant || !restaurant.isActive) {
    return NextResponse.json({ error: "Restaurant is unavailable" }, { status: 403 });
  }
  const access = await getEffectiveAccess(restaurant);
  if (!canOrder(access)) {
    return NextResponse.json({ error: "Ordering is not available at this restaurant." }, { status: 403 });
  }

  const session = await startTableSession(table.id, table.restaurantId, parsed.data.customerName);
  return NextResponse.json(session, { status: 201 });
}