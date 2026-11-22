import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "menu-saas",
      db: "up",
      ts: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Health] Database check failed:", error);
    return NextResponse.json(
      { ok: false, service: "menu-saas", db: "down", ts: new Date().toISOString() },
      { status: 503 }
    );
  }
}