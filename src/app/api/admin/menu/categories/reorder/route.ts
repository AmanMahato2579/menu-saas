import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const reorderSchema = z.object({
  order: z.array(z.string().min(1)).max(500),
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

  // Restrict the submitted order to categories that actually belong to this
  // restaurant, so a malformed payload can never write out-of-scope rows.
  const owned = await prisma.category.findMany({
    where: { restaurantId },
    select: { id: true },
  });
  const validIds = new Set(owned.map((c) => c.id));
  const order = parsed.data.order.filter((id) => validIds.has(id));

  await prisma.$transaction(
    order.map((id, index) =>
      prisma.category.update({ where: { id }, data: { sortOrder: index } })
    )
  );

  return NextResponse.json({ success: true });
}