import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BRAND_COLOR_KEYS } from "@/lib/brand";
import { logActivity } from "@/lib/activity";

async function isSuperAdmin() {
  const session = await auth();
  return (session?.user as { role?: string })?.role === "SUPER_ADMIN";
}

const patchSchema = z
  .object({
    name: z.string().min(2).max(200).optional(),
    phone: z.string().max(50).nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    description: z.string().max(1000).nullable().optional(),
    tableLimit: z.number().int().min(1).max(200).optional(),
    isActive: z.boolean().optional(),
    plan: z.enum(["STAR", "SILVER", "BRONZE"]).optional(),
    bookingsEnabled: z.boolean().optional(),
    brandColor: z.string().refine((v) => BRAND_COLOR_KEYS.has(v)).optional(),
    subscriptionStatus: z.enum(["ACTIVE", "EXPIRED", "CANCELLED", "SUSPENDED"]).optional(),
    subscriptionStart: z.string().datetime().nullable().optional(),
    subscriptionExpiresAt: z.string().datetime().nullable().optional(),
    neverExpires: z.boolean().optional(),
    autoOff: z.boolean().optional(),
    starNumber: z.number().int().min(1).max(10).nullable().optional(),
    starNote: z.string().max(500).nullable().optional(),
    extendDays: z.number().int().min(1).max(3650).optional(),
  })
  .refine((v) => !(v.starNumber === undefined && v.starNote !== undefined), {
    message: "starNote requires starNumber",
  });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { restaurantId } = await params;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, plan: true, starNumber: true, neverExpires: true, subscriptionExpiresAt: true, isActive: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  if (data.tableLimit !== undefined) {
    const tableCount = await prisma.table.count({ where: { restaurantId } });
    if (data.tableLimit < tableCount)
      return NextResponse.json({ error: `The limit cannot be lower than the ${tableCount} existing QR tables.` }, { status: 400 });
  }

  if (data.starNumber !== undefined && data.starNumber !== null) {
    const taken = await prisma.restaurant.findFirst({
      where: { starNumber: data.starNumber, id: { not: restaurantId } },
      select: { name: true },
    });
    if (taken)
      return NextResponse.json({ error: `Star #${data.starNumber} is already assigned to ${taken.name}.` }, { status: 409 });
  }

  const update: Record<string, unknown> = {};

  // Plain profile / plan / toggles
  for (const key of ["name", "phone", "address", "description", "tableLimit", "isActive", "plan", "bookingsEnabled", "brandColor", "subscriptionStatus"] as const) {
    if (data[key] !== undefined) update[key] = data[key];
  }
  if (data.subscriptionStart !== undefined) update.subscriptionStart = data.subscriptionStart === null ? null : new Date(data.subscriptionStart);
  if (data.subscriptionExpiresAt !== undefined) update.subscriptionExpiresAt = data.subscriptionExpiresAt === null ? null : new Date(data.subscriptionExpiresAt);
  if (data.neverExpires !== undefined) update.neverExpires = data.neverExpires;
  if (data.autoOff !== undefined) update.autoOff = data.autoOff;
  if (data.starNote !== undefined) update.starNote = data.starNote;
  if (data.starNumber !== undefined) update.starNumber = data.starNumber;

  // Star assignment implies plan STAR, and an assignment resets the subscription
  // to an active, never-expiring founding status.
  if (data.starNumber !== undefined && data.starNumber !== null) {
    update.plan = "STAR";
    update.subscriptionStatus = "ACTIVE";
    if (!data.neverExpires && restaurant.neverExpires) update.neverExpires = true;
    if (!update.subscriptionExpiresAt) update.subscriptionExpiresAt = null;
    if (!update.subscriptionStart) update.subscriptionStart = new Date();
  }

  // Extend by N days from now (or current future expiry), and clear neverExpires.
  if (data.extendDays !== undefined) {
    const base = update.subscriptionExpiresAt === undefined && restaurant.subscriptionExpiresAt
      ? new Date(restaurant.subscriptionExpiresAt)
      : null;
    const start =
      base && base.getTime() > Date.now()
        ? base
        : new Date();
    update.subscriptionExpiresAt = new Date(start.getTime() + data.extendDays * 86400000);
    update.neverExpires = false;
    update.subscriptionStatus = "ACTIVE";
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: update,
  });

  // Audit trail
  const activities: { action: string; detail: string }[] = [];
  if (data.isActive !== undefined && data.isActive !== restaurant.isActive)
    activities.push({ action: data.isActive ? "restaurant_activated" : "restaurant_deactivated", detail: data.isActive ? "Restaurant activated" : "Restaurant deactivated" });
  if (data.plan !== undefined && data.plan !== restaurant.plan)
    activities.push({ action: "plan_changed", detail: `${restaurant.plan} → ${data.plan}` });
  if (data.starNumber !== undefined) {
    if (data.starNumber !== null) activities.push({ action: "star_assigned", detail: `Star #${data.starNumber}` });
    else if (restaurant.starNumber !== null) activities.push({ action: "star_removed", detail: `Star #${restaurant.starNumber} removed` });
  }
  if (data.extendDays !== undefined)
    activities.push({ action: "subscription_changed", detail: `Extended by ${data.extendDays} day(s)` });
  if (data.subscriptionExpiresAt !== undefined)
    activities.push({ action: "subscription_changed", detail: `Expiry set to ${data.subscriptionExpiresAt === null ? "none" : data.subscriptionExpiresAt}` });
  if (data.neverExpires !== undefined)
    activities.push({ action: "subscription_changed", detail: data.neverExpires ? "Never-expires enabled" : "Never-expires disabled" });
  if (data.autoOff !== undefined)
    activities.push({ action: "subscription_changed", detail: data.autoOff ? "Auto-off enabled" : "Auto-off disabled" });
  if (data.tableLimit !== undefined)
    activities.push({ action: "limit_changed", detail: `QR table limit → ${data.tableLimit}` });
  if (data.bookingsEnabled !== undefined)
    activities.push({ action: data.bookingsEnabled ? "bookings_enabled" : "bookings_disabled", detail: "" });

  for (const { action, detail } of activities) {
    await logActivity(action, { restaurantId, restaurantName: updated.name, detail: detail || undefined });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { restaurantId } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } });

  try {
    // OrderItem rows reference MenuItem / MenuItemVariant without ON DELETE
    // (order history must survive menu edits), so the cascade from
    // Restaurant -> MenuItem is otherwise blocked. Clear the restaurant's
    // order items first, then drop the restaurant (everything else cascades).
    await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { menuItem: { restaurantId } } }),
      prisma.orderSequence.deleteMany({ where: { restaurantId } }),
      prisma.restaurant.delete({ where: { id: restaurantId } }),
    ]);
    await logActivity("restaurant_deleted", { restaurantId, restaurantName: restaurant?.name ?? null });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Restaurant Delete Error]:", error);
    return NextResponse.json({ error: "Failed to delete restaurant: " + (error as Error).message }, { status: 500 });
  }
}