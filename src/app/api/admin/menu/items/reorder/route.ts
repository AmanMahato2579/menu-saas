import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const reorderSchema = z.object({
  categoryId: z.string().min(1),
  order: z.array(z.string().min(1)).max(2000),
});

async function getRestaurantId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
}

export async function PATCH(req: Request) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // The target category must belong to this restaurant (tenant isolation) and
  // reordering only ever touches items inside that category.
  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, restaurantId },
    select: { id: true },
  });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const owned = await prisma.menuItem.findMany({
    where: { categoryId: parsed.data.categoryId },
    select: { id: true },
  });
  const validIds = new Set(owned.map((i) => i.id));
  const order = parsed.data.order.filter((id) => validIds.has(id));

  await prisma.$transaction(
    order.map((id, index) =>
      prisma.menuItem.update({ where: { id }, data: { sortOrder: index } })
    )
  );

  return NextResponse.json({ success: true });
}