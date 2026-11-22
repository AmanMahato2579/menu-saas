import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createBooking, getBookableSlots, getCustomerBookings } from "@/lib/db";
import { getEffectiveAccess, canBook } from "@/lib/plans";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const createSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinutes: z.coerce.number().int().min(0).max(1439),
  durationMinutes: z.coerce.number().int().min(30).max(1440),
  contactName: z.string().trim().min(1).max(80),
  contactPhone: z.string().trim().min(4).max(30),
  guests: z.coerce.number().int().min(1).max(500).default(1),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`booking:${clientIp(req)}`, 6, 60_000)) {
    return NextResponse.json({ error: "Too many booking attempts. Try again in a minute." }, { status: 429 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid booking details" }, { status: 400 });

  const { slug, serviceId, bookingDate, startMinutes, durationMinutes, contactName, contactPhone, guests, note } = parsed.data;

  const restaurant = await prisma.restaurant.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      bookingsEnabled: true,
      plan: true,
      featureOverrides: true,
      limitOverrides: true,
      starNumber: true,
    },
  });
  if (!restaurant) return NextResponse.json({ error: "Restaurant is unavailable" }, { status: 404 });

  const access = await getEffectiveAccess(restaurant);
  if (!canBook(access, restaurant.bookingsEnabled)) {
    return NextResponse.json({ error: "Bookings are not available at this restaurant." }, { status: 403 });
  }

  const service = await prisma.bookableService.findFirst({
    where: { id: serviceId, restaurantId: restaurant.id, isActive: true },
    select: { id: true },
  });
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  // Re-check availability before insert to give a friendly error message.
  const slots = await getBookableSlots(serviceId, restaurant.id, bookingDate);
  const matches = slots.some((s) => s.startMinutes === startMinutes && s.endMinutes - s.startMinutes >= durationMinutes);
  if (!matches) {
    return NextResponse.json({ error: "That slot is no longer available" }, { status: 409 });
  }

  const result = await createBooking({
    restaurantId: restaurant.id,
    serviceId,
    tableSessionId: null,
    contactName,
    contactPhone,
    note,
    bookingDate,
    startMinutes,
    durationMinutes,
    guests,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ id: result.bookingId }, { status: 201 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const phone = searchParams.get("phone");
  if (!slug || !phone) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

  const restaurant = await prisma.restaurant.findFirst({
    where: { slug, isActive: true },
    select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Restaurant is unavailable" }, { status: 404 });

  const bookings = await getCustomerBookings(restaurant.id, phone);
  return NextResponse.json(bookings);
}
