import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { orderRejectedMessage, orderRejectedTitle } from "@/lib/i18n";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { AdminUser } from "@/types";

const statusSchema = z.object({
  // Order-level status now only drives the intake/acknowledgment lifecycle.
  // Food progress is tracked per item (NEW → PREPARING → SERVED), so the
  // legacy READY/COMPLETED values are intentionally no longer accepted here.
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as unknown as AdminUser;
  const restaurantId = user.restaurantId;

  if (!restaurantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await params;

  const body = await req.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Ensure order belongs to this restaurant (tenant isolation)
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: {
      orderItems: true,
      tableSession: { include: { table: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: parsed.data.status, statusChangedAt: new Date() },
  });

  // Accepting an order also moves its pending items into the kitchen queue —
  // acceptance and "start preparing" happen in one step.
  if (parsed.data.status === "ACCEPTED") {
    await prisma.orderItem.updateMany({
      where: { orderId, status: "NEW" },
      data: { status: "PREPARING" },
    });
  }

  if (parsed.data.status === "REJECTED") {
    const tableNumber = order.tableSession?.table?.tableNumber;
    const itemSummary = order.orderItems
      .map((i) => `${i.menuItemName} ×${i.quantity}`)
      .join(", ");
    const lang = (await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { language: true } }))?.language ?? "EN";
    await createNotification({
      restaurantId,
      type: "ORDER_STATUS",
      title: orderRejectedTitle(lang, order.orderNumber),
      message: orderRejectedMessage(lang, tableNumber, itemSummary),
      link: "/admin/orders",
    });
  }

  return NextResponse.json(updated);
}
