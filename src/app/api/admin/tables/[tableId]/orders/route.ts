import { auth } from "@/lib/auth";
import { createWaiterOrder } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const waiterOrderSchema = z.object({
  items: z.array(
    z.object({
      menuItemId: z.string(),
      variantId: z.string().optional().nullable(),
      quantity: z.number().int().positive(),
      isSpicy: z.boolean().optional(),
      note: z.string().optional(),
    })
  ).min(1, "No items selected"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string | null })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tableId } = await params;

  const parsed = waiterOrderSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const order = await createWaiterOrder({
      restaurantId,
      tableId,
      items: parsed.data.items,
    });
    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}