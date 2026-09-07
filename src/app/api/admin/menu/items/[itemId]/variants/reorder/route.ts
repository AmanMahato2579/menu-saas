import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const reorderSchema = z.object({
  order: z.array(z.string().min(1)).max(200),
});

async function getRestaurantId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;
  const item = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const body = await req.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Only ever reorder variants that actually belong to this item (tenant isolation).
  const owned = await prisma.menuItemVariant.findMany({
    where: { menuItemId: itemId },
    select: { id: true },
  });
  const validIds = new Set(owned.map((v) => v.id));
  const order = parsed.data.order
    .map((id) => id)
    .filter((id) => validIds.has(id))
    .filter((id, index, arr) => arr.indexOf(id) === index);

  await prisma.$transaction(
    order.map((id, index) =>
      prisma.menuItemVariant.update({ where: { id }, data: { sortOrder: index } })
    )
  );

  return NextResponse.json({ success: true });
}