import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const patchSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

async function getRestaurantId(): Promise<string | null> {
  const session = await auth();
    return (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { offerId } = await params;
  const existing = await prisma.specialOffer.findFirst({ where: { id: offerId, restaurantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const updateData = { ...parsed.data } as Prisma.SpecialOfferUpdateInput;
  if (parsed.data.startDate) updateData.startDate = new Date(parsed.data.startDate);
  if (parsed.data.endDate) updateData.endDate = new Date(parsed.data.endDate);
  const updated = await prisma.specialOffer.update({ where: { id: offerId }, data: updateData });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { offerId } = await params;
  const existing = await prisma.specialOffer.findFirst({ where: { id: offerId, restaurantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.specialOffer.delete({ where: { id: offerId } });
  return NextResponse.json({ success: true });
}
