import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ALL_FEATURE_KEYS, ALL_FEATURES_MARKER } from "@/lib/plan-catalog";
import { logActivity } from "@/lib/activity";

async function isSuperAdmin() {
  const session = await auth();
  return (session?.user as { role?: string })?.role === "SUPER_ADMIN";
}

const FEATURE_VALUES = [...ALL_FEATURE_KEYS, ALL_FEATURES_MARKER] as const;

const featureKeysSchema = z.union([
  z.array(z.enum(FEATURE_VALUES)),
  z.literal(ALL_FEATURES_MARKER),
]);

const limitKeysSchema = z.record(z.string(), z.number().int().min(0)).refine((v) => "qrTables" in v, {
  message: "limitKeys must include qrTables",
});

const patchSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  priceMonthly: z.number().min(0).nullable().optional(),
  priceYearly: z.number().min(0).nullable().optional(),
  featureKeys: featureKeysSchema.optional(),
  limitKeys: limitKeysSchema.optional(),
  isVisible: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET() {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(plans);
}

export async function PATCH(req: Request) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id, ...data } = parsed.data;
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  for (const key of ["name", "description", "priceMonthly", "priceYearly", "isVisible", "isActive", "sortOrder"] as const) {
    if (data[key] !== undefined) update[key] = data[key];
  }
  if (data.featureKeys !== undefined) update.featureKeys = JSON.stringify(data.featureKeys);
  if (data.limitKeys !== undefined) update.limitKeys = JSON.stringify(data.limitKeys);

  const updated = await prisma.plan.update({ where: { id }, data: update });

  await logActivity("plan_updated", {
    detail: `Plan ${id} configuration updated`,
  });

  return NextResponse.json(updated);
}