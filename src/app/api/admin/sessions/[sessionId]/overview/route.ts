import { auth } from "@/lib/auth";
import { getSessionOverview } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string | null })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const overview = await getSessionOverview(sessionId, restaurantId);
  if (!overview) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  return NextResponse.json(JSON.parse(JSON.stringify(overview)));
}