import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  isAvailable: z.boolean(),
});

async function getRestaurantId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string; variantId: string }> }
) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId, variantId } = await params;

  // The item must exist and belong to this restaurant first.
  const item = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const variant = await prisma.menuItemVariant.findFirst({ where: { id: variantId, menuItemId: itemId } });
  if (!variant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.menuItemVariant.update({
    where: { id: variantId },
    data: { isAvailable: parsed.data.isAvailable },
  });
  return NextResponse.json(updated);
}