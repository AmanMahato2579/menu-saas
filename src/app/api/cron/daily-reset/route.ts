import { NextRequest, NextResponse } from "next/server";
import { runDailyReset } from "@/lib/daily-reset";

/**
 * Nightly data reset hook (started by the Vercel cron configured in
 * vercel.json, or locally by `npm run daily-reset`).
 *
 * On Vercel, cron requests carry the unspoofable `x-vercel-cron` header.
 * A CRON_SECRET bearer check is also honored so the endpoint can be invoked
 * by any external scheduler that signs requests.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailyReset();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[daily-reset] run failed", error);
    return NextResponse.json({ ok: false, error: "Daily reset failed" }, { status: 500 });
  }
}

function isAuthorized(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const secret = process.env.CRON_SECRET;
  if (secret) return request.headers.get("authorization") === `Bearer ${secret}`;
  return false;
}
