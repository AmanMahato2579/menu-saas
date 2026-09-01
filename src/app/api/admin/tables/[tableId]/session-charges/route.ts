import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
const schema = z.object({ applyTax: z.boolean().optional(), applyServiceCharge: z.boolean().optional() });
export async function PATCH(req: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const session = await auth(); const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = schema.safeParse(await req.json()); if (!data.success) return NextResponse.json({ error: "Invalid charges" }, { status: 400 });
  const { tableId } = await params;
  const updated = await prisma.tableSession.updateMany({ where: { tableId, restaurantId, status: "ACTIVE" }, data: data.data });
  return NextResponse.json(updated);
}
