import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { listActivity } from "@/lib/activity";

async function isSuperAdmin() {
  const session = await auth();
  return (session?.user as { role?: string })?.role === "SUPER_ADMIN";
}

export async function GET(req: Request) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const limit = Number.parseInt(searchParams.get("limit") ?? "60", 10);
  const safe = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 60;
  return NextResponse.json(await listActivity({ limit: safe }));
}