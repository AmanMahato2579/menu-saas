import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
const schema = z.object({ password: z.string().min(8).max(128) });
export async function POST(req: Request, { params }: { params: Promise<{ restaurantId: string }> }) {
  const session = await auth(); if ((session?.user as { role?: string })?.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: "Password must contain at least 8 characters" }, { status: 400 });
  const { restaurantId } = await params;
  const result = await prisma.user.updateMany({ where: { restaurantId, role: "RESTAURANT_ADMIN" }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) } });
  if (!result.count) return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
