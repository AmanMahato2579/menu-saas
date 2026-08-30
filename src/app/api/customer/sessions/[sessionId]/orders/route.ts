import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const orders = await prisma.order.findMany({
    where: { tableSessionId: sessionId },
    include: { orderItems: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(orders)));
}
