import { handlers } from "@/lib/auth";
import type { NextRequest } from "next/server";

type RouteContext = { params?: Record<string, string | string[]> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  return (handlers.GET as unknown as (req: NextRequest, ctx: RouteContext) => Promise<Response>)(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  return (handlers.POST as unknown as (req: NextRequest, ctx: RouteContext) => Promise<Response>)(req, ctx);
}
