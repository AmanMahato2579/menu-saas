import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

async function getRestaurantId(req: Request): Promise<string | null> {
  const session = await auth();
  return (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
}

export async function GET(req: Request) {
  const restaurantId = await getRestaurantId(req);
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await prisma.category.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const restaurantId = await getRestaurantId(req);
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const category = await prisma.category.create({
    data: { ...parsed.data, restaurantId },
  });
  return NextResponse.json(category, { status: 201 });
}
