import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminBookableServices } from "@/lib/db";

const serviceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(["ROOM", "POOL", "TABLE_GAME", "ADVENTURE", "OTHER"]),
  description: z.string().max(1000).optional().nullable(),
  price: z.coerce.number().min(0).default(0),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(500).default(2),
  venueCount: z.coerce.number().int().min(1).max(100).default(1),
  slotDurationMinutes: z.coerce.number().int().min(30).max(1440).default(60),
  openingMinutes: z.coerce.number().int().min(0).max(1439).default(480),
  closingMinutes: z.coerce.number().int().min(1).max(1440).default(1380),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
}).superRefine((data, ctx) => {
  if (data.openingMinutes >= data.closingMinutes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Closing time must be after opening time", path: ["closingMinutes"] });
  }
});

async function getRestaurantId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
}

export async function GET() {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const services = await getAdminBookableServices(restaurantId);
  return NextResponse.json(services);
}

export async function POST(req: Request) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { bookingsEnabled: true },
  });
  if (!restaurant?.bookingsEnabled) {
    return NextResponse.json({ error: "Booking feature is disabled" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { imageUrl, ...rest } = parsed.data;
  const service = await prisma.bookableService.create({
    data: {
      ...rest,
      restaurantId,
      imageUrl: imageUrl ? String(imageUrl) : null,
      sortOrder: parsed.data.sortOrder,
    },
  });
  return NextResponse.json(service, { status: 201 });
}