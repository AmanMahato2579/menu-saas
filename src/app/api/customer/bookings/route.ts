import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createBooking, getBookableSlots, getCustomerBookings } from "@/lib/db";

const createSchema = z.object({
  token: z.string().min(1),
  serviceId: z.string().min(1),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinutes: z.coerce.number().int().min(0).max(1439),
  durationMinutes: z.coerce.number().int().min(30).max(1440),
  contactName: z.string().trim().min(1).max(80),
  contactPhone: z.string().trim().min(4).max(30),
  guests: z.coerce.number().int().min(1).max(500).default(1),
  note: z.string().trim().max(500).optional(),
  sessionId: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid booking details" }, { status: 400 });

  const { token, serviceId, bookingDate, startMinutes, durationMinutes, contactName, contactPhone, guests, note, sessionId } = parsed.data;

  const table = await prisma.table.findFirst({
    where: { qrToken: token, isActive: true, restaurant: { isActive: true } },
  });
  if (!table) return NextResponse.json({ error: "Table is unavailable" }, { status: 404 });

  // Re-check availability before insert to give a friendly error message.
  const slots = await getBookableSlots(serviceId, table.restaurantId, bookingDate);
  const matches = slots.some((s) => s.startMinutes === startMinutes && s.endMinutes - s.startMinutes >= durationMinutes);
  if (!matches) {
    return NextResponse.json({ error: "That slot is no longer available" }, { status: 409 });
  }

  const result = await createBooking({
    restaurantId: table.restaurantId,
    serviceId,
    tableSessionId: sessionId || null,
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
  const token = searchParams.get("token");
  const phone = searchParams.get("phone");
  if (!token || !phone) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

  const table = await prisma.table.findFirst({
    where: { qrToken: token, isActive: true, restaurant: { isActive: true } },
  });
  if (!table) return NextResponse.json({ error: "Table is unavailable" }, { status: 404 });

  const bookings = await getCustomerBookings(table.restaurantId, phone);
  return NextResponse.json(bookings);
}