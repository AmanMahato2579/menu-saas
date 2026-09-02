import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

async function isSuperAdmin() {
  const session = await auth();
  return (session?.user as { role?: string })?.role === "SUPER_ADMIN";
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { restaurantId } = await params;
  const data = z.object({ name: z.string().min(2).max(200).optional(), phone: z.string().max(50).nullable().optional(), address: z.string().max(500).nullable().optional(), description: z.string().max(1000).nullable().optional(), tableLimit: z.number().int().min(1).max(200).optional(), isActive: z.boolean().optional() }).safeParse(await req.json());
  if (!data.success) return NextResponse.json({ error: data.error.flatten() }, { status: 400 });
  if (data.data.tableLimit !== undefined) {
    const tableCount = await prisma.table.count({ where: { restaurantId } });
    if (data.data.tableLimit < tableCount) return NextResponse.json({ error: `The limit cannot be lower than the ${tableCount} existing QR tables.` }, { status: 400 });
  }
  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: data.data,
  });
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
  
  await prisma.restaurant.delete({
    where: { id: restaurantId },
  });
  
  return NextResponse.json({ success: true });
}
