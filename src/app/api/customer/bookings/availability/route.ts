import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBookableSlots } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const serviceId = searchParams.get("serviceId");
  const date = searchParams.get("date");

  if (!token || !serviceId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 });
  }

  const table = await prisma.table.findFirst({
    where: { qrToken: token, isActive: true, restaurant: { isActive: true } },
  });
  if (!table) return NextResponse.json({ error: "Table is unavailable" }, { status: 404 });

  const service = await prisma.bookableService.findFirst({
    where: { id: serviceId, restaurantId: table.restaurantId, isActive: true },
    select: { id: true },
  });
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  const slots = await getBookableSlots(serviceId, table.restaurantId, date);
  return NextResponse.json({ slots });
}