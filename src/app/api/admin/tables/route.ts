import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

async function getRestaurantId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
}

const tableSchema = z.object({
  tableNumber: z.number().int().positive(),
});

export async function GET() {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tables = await prisma.table.findMany({
    where: { restaurantId },
    orderBy: { tableNumber: "asc" },
  });
  return NextResponse.json(tables);
}

export async function POST(req: Request) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = tableSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const [restaurant, existing, existingCount] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { tableLimit: true } }),
    prisma.table.findFirst({ where: { restaurantId, tableNumber: parsed.data.tableNumber } }),
    prisma.table.count({ where: { restaurantId } }),
  ]);
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  if (existing) {
    return NextResponse.json({ error: `Table ${parsed.data.tableNumber} already exists` }, { status: 409 });
  }
  if (existingCount >= restaurant.tableLimit) return NextResponse.json({ error: `Table limit reached (${restaurant.tableLimit}). Contact the platform administrator to increase it.` }, { status: 403 });

  const table = await prisma.table.create({
    data: { restaurantId, tableNumber: parsed.data.tableNumber },
  });
  return NextResponse.json(table, { status: 201 });
}
