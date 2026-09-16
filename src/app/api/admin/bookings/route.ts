import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getAdminBookings } from "@/lib/db";

async function getRestaurantId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
}

export async function GET(req: Request) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const bookings = await getAdminBookings(restaurantId, date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined);
  return NextResponse.json(bookings);
}