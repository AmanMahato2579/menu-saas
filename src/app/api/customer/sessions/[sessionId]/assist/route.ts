import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { assistanceMessage, assistanceTitle } from "@/lib/i18n";

export async function POST(_: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await prisma.tableSession.findFirst({ where: { id: sessionId, status: "ACTIVE" }, include: { table: true } });
  if (!session) return NextResponse.json({ error: "This table session has ended." }, { status: 409 });
  const lang = (await prisma.restaurant.findUnique({ where: { id: session.restaurantId }, select: { language: true } }))?.language ?? "EN";
  await createNotification({
    restaurantId: session.restaurantId, type: "ASSISTANCE_REQUEST", title: assistanceTitle(lang),
    message: assistanceMessage(lang, session.customerName, session.table?.tableNumber), link: "/admin/notifications",
  });
  return NextResponse.json({ success: true });
}
