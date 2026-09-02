import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const itemSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  price: z.coerce.number().positive("Price must be positive"),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  isAvailable: z.boolean().default(true),
  hasSpicyOption: z.boolean().default(false),
  hasNoteOption: z.boolean().default(true),
  ingredients: z.string().optional().nullable(),
  discountPercent: z.coerce.number().int().min(0).max(100).default(0),
});

async function getRestaurantId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
}

export async function POST(req: Request) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify category belongs to this restaurant
  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, restaurantId },
  });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const item = await prisma.menuItem.create({
    data: {
      ...parsed.data,
      restaurantId,
      imageUrl: parsed.data.imageUrl || null,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
