import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder } from "@/lib/db";
import { loadOperationalRestaurant, getEffectiveAccess, canOrder } from "@/lib/plans";

const orderSchema = z.object({
  restaurantId: z.string(),
  tableSessionId: z.string(),
  customerToken: z.string(),
  items: z.array(
    z.object({
      menuItemId: z.string(),
      variantId: z.string().optional(),
      quantity: z.number().int().positive(),
      isSpicy: z.boolean(),
      note: z.string(),
    })
  ).min(1, "Cart is empty"),
});

export async function POST(req: Request) {
  // Customer endpoint - no auth required, but we validate everything server-side
  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { restaurantId, tableSessionId, customerToken, items } = parsed.data;

  const restaurant = await loadOperationalRestaurant(restaurantId);
  if (!restaurant || !restaurant.isActive) {
    return NextResponse.json({ error: "Restaurant is unavailable" }, { status: 403 });
  }
  const access = await getEffectiveAccess(restaurant);
  if (!canOrder(access)) {
    return NextResponse.json({ error: "Ordering is not available at this restaurant." }, { status: 403 });
  }

  // Validate the table session belongs to this restaurant (tenant isolation, no trust in client)
  const session = await prisma.tableSession.findFirst({
    where: { id: tableSessionId, restaurantId, status: "ACTIVE" },
  });

  if (!session) {
    return NextResponse.json(
      { error: "Invalid or expired session. Please scan the QR code again." },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder({ restaurantId, tableSessionId, customerToken, items });
    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
