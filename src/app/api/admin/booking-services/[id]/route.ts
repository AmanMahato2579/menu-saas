import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  type: z.enum(["ROOM", "POOL", "TABLE_GAME", "ADVENTURE", "OTHER"]).optional(),
  description: z.string().max(1000).nullable().optional(),
  price: z.coerce.number().min(0).optional(),
  imageUrl: z.string().url().nullable().optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(500).optional(),
  venueCount: z.coerce.number().int().min(1).max(100).optional(),
  slotDurationMinutes: z.coerce.number().int().min(30).max(1440).optional(),
  openingMinutes: z.coerce.number().int().min(0).max(1439).optional(),
  closingMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

async function getRestaurantId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.bookableService.findFirst({
    where: { id, restaurantId },
    select: { id: true, openingMinutes: true, closingMinutes: true },
  });
  if (!existing) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const o = parsed.data.openingMinutes ?? existing.openingMinutes;
  const c = parsed.data.closingMinutes ?? existing.closingMinutes;
  if (o >= c) return NextResponse.json({ error: "Closing time must be after opening time" }, { status: 400 });

  const { imageUrl, ...rest } = parsed.data;
  const updated = await prisma.bookableService.update({
    where: { id },
    data: {
      ...rest,
      ...(imageUrl !== undefined ? { imageUrl: imageUrl ? String(imageUrl) : null } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.bookableService.findFirst({
    where: { id, restaurantId },
    include: { _count: { select: { bookings: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Service not found" }, { status: 404 });
  if (existing._count.bookings > 0) {
    return NextResponse.json(
      { error: "This service has booking history. Deactivate it instead of deleting." },
      { status: 400 }
    );
  }
  await prisma.bookableService.delete({ where: { id } });
  return NextResponse.json({ success: true });
}