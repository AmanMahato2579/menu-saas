import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getRestaurantId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
}

export async function GET(req: Request) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 50);

  const where = { restaurantId, ...(unreadOnly ? { read: false } : {}) };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { restaurantId, read: false } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH() {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updated = await prisma.notification.updateMany({
    where: { restaurantId, read: false },
    data: { read: true },
  });

  return NextResponse.json({ success: true, updated: updated.count });
}
