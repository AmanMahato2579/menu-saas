import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await prisma.tableSession.findFirst({ where: { id: sessionId, status: "ACTIVE" }, include: { table: true } });
  if (!session) return NextResponse.json({ error: "This table session has ended." }, { status: 409 });
  await prisma.notification.create({ data: {
    restaurantId: session.restaurantId, type: "ASSISTANCE_REQUEST", title: "Assistance requested",
    message: `${session.customerName || "Guest"} needs help at Table ${session.table.tableNumber}.`, link: "/admin/notifications",
  }});
  return NextResponse.json({ success: true });
}
