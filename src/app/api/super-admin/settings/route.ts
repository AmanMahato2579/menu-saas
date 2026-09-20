import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformSettings, savePlatformSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

async function isSuperAdmin() {
  const session = await auth();
  return (session?.user as { role?: string })?.role === "SUPER_ADMIN";
}

const settingsSchema = z.object({
  platformName: z.string().min(1).max(100).optional(),
  defaultTableLimit: z.number().int().min(1).max(200).optional(),
  defaultSubscriptionDays: z.number().int().min(1).max(3650).optional(),
  newRestaurantNeverExpires: z.boolean().optional(),
  newRestaurantAutoOff: z.boolean().optional(),
});

export async function GET() {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await getPlatformSettings());
}

export async function PATCH(req: Request) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = settingsSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await savePlatformSettings(parsed.data);
  await logActivity("settings_updated", { detail: JSON.stringify(parsed.data) });
  return NextResponse.json({ success: true, settings: await getPlatformSettings() });
}