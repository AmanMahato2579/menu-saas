import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { slugify } from "@/lib/utils";
import { getPlatformSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  name: z.string().min(2),
  ownerName: z.string().min(1),
  ownerEmail: z.string().email(),
  tempPassword: z.string().min(6),
  tableCount: z.number().int().min(0).max(200).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  plan: z.enum(["STAR", "SILVER", "BRONZE"]).optional(),
  starNumber: z.number().int().min(1).max(10).nullable().optional(),
});

async function isSuperAdmin() {
  const session = await auth();
  return (session?.user as { role?: string })?.role === "SUPER_ADMIN";
}

export async function POST(req: Request) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, ownerName, ownerEmail, tempPassword, phone, address, plan, starNumber } = parsed.data;
  const settings = await getPlatformSettings();
  const tableCount = parsed.data.tableCount ?? settings.defaultTableLimit;

  if (starNumber && plan && plan !== "STAR") {
    return NextResponse.json({ error: "A restaurant with a star number must be on the STAR plan." }, { status: 400 });
  }
  if (starNumber) {
    const taken = await prisma.restaurant.findFirst({ where: { starNumber } });
    if (taken) return NextResponse.json({ error: `Star #${starNumber} is already assigned to ${taken.name}.` }, { status: 409 });
  }

  // Generate unique slug
  let slug = slugify(name);
  const existing = await prisma.restaurant.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const isStar = starNumber != null;
  const expiry =
    settings.newRestaurantNeverExpires || isStar
      ? null
      : new Date(Date.now() + settings.defaultSubscriptionDays * 86400000);

  // Create restaurant + owner + tables in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.create({
      data: {
        name,
        slug,
        phone,
        address,
        tableLimit: tableCount,
        plan: isStar ? "STAR" : (plan ?? "STAR"),
        starNumber,
        subscriptionStatus: "ACTIVE",
        subscriptionStart: new Date(),
        subscriptionExpiresAt: expiry,
        neverExpires: isStar || settings.newRestaurantNeverExpires,
        autoOff: settings.newRestaurantAutoOff,
      },
    });

    const user = await tx.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        passwordHash,
        role: "RESTAURANT_ADMIN",
        restaurantId: restaurant.id,
      },
    });

    // Create tables
    if (tableCount > 0) {
      await tx.table.createMany({
        data: Array.from({ length: tableCount }, (_, i) => ({
          restaurantId: restaurant.id,
          tableNumber: i + 1,
        })),
      });
    }

    return { restaurant, user };
  });

  await logActivity("restaurant_created", {
    restaurantId: result.restaurant.id,
    restaurantName: result.restaurant.name,
    detail: isStar ? `Star founding assignment #${starNumber}` : `Plan: ${result.restaurant.plan}`,
  });
  if (isStar) {
    await logActivity("star_assigned", {
      restaurantId: result.restaurant.id,
      restaurantName: result.restaurant.name,
      detail: `Star #${starNumber}`,
    });
  }

  return NextResponse.json(result, { status: 201 });
}