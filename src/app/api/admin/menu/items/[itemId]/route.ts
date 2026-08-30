import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const patchSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  price: z.coerce.number().positive().optional(),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  isAvailable: z.boolean().optional(),
  hasSpicyOption: z.boolean().optional(),
  hasNoteOption: z.boolean().optional(),
  ingredients: z.string().optional().nullable(),
  discountPercent: z.coerce.number().int().min(0).max(100).optional(),
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
  const existing = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updateData = { ...parsed.data } as Prisma.MenuItemUpdateInput;
  if (parsed.data.imageUrl === "") updateData.imageUrl = null;

  const updated = await prisma.menuItem.update({ where: { id: itemId }, data: updateData });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;
  const existing = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.menuItem.delete({ where: { id: itemId } });
  return NextResponse.json({ success: true });
}
