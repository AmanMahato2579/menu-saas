import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const itemSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  price: z.coerce.number().min(0).default(0),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  isAvailable: z.boolean().default(true),
  hasSpicyOption: z.boolean().default(false),
  hasNoteOption: z.boolean().default(true),
  ingredients: z.string().optional().nullable(),
  discountPercent: z.coerce.number().int().min(0).max(100).default(0),
  foodType: z.enum(["VEG", "NON_VEG"]).default("VEG"),
  variants: z.array(z.object({
    name: z.string().trim().min(1).max(50),
    price: z.coerce.number().positive(),
    foodType: z.enum(["VEG", "NON_VEG"]).optional().nullable(),
  })).max(20).default([]),
}).superRefine((data, ctx) => {
  if ((!data.variants || data.variants.length === 0) && data.price <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Price must be greater than 0 when no variants are added",
      path: ["price"],
    });
  }
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

  // If variants exist and base price is 0, auto-fill base price with first variant's price
  let finalPrice = parsed.data.price;
  if (parsed.data.variants.length > 0 && finalPrice <= 0) {
    finalPrice = parsed.data.variants[0].price;
  }

  const item = await prisma.menuItem.create({
    data: {
      ...parsed.data,
      price: finalPrice,
      restaurantId,
      imageUrl: parsed.data.imageUrl || null,
      variants: { create: parsed.data.variants },
    },
  });
  return NextResponse.json(item, { status: 201 });
}
