import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const settingsSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  currency: z.string().default("Rs."),
  openingHours: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string | null })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: parsed.data,
  });
  return NextResponse.json(updated);
}
