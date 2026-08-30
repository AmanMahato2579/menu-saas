import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { AdminUser } from "@/types";

const statusSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "REJECTED"]),
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
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: parsed.data.status },
  });

  return NextResponse.json(updated);
}
