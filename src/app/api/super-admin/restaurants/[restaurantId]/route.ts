import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
  const { isActive } = await req.json();
  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { isActive },
  });
  return NextResponse.json(updated);
}
