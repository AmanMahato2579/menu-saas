import { prisma } from "@/lib/prisma";
import {
  ALL_FEATURE_KEYS,
  ALL_FEATURES_MARKER,
  DEFAULT_PLAN_CONFIGS,
  isPlanId,
} from "@/lib/plan-catalog";
import { logActivity } from "@/lib/activity";

// ─── Effective Access ─────────────────────────────────────────────────────────
// The single source of truth for what a restaurant can do:
//
//   Restaurant → Subscription → Plan → Plan features/limits → Customer overrides
//   → Effective permissions → Application access
//
// Nothing else in the app should gate on `restaurant.plan === "…"` directly.

export interface RestaurantAccessInput {
  plan?: string | null;
  featureOverrides?: string | null;
  limitOverrides?: string | null;
  starNumber?: number | null;
}

export interface EffectiveAccess {
  plan: string;
  isStar: boolean;
  starNumber: number | null;
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

export function parseFeatureKeys(json: string | null | undefined): string[] {
  try {
    const arr = JSON.parse(json ?? "[]");
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function parseLimitKeys(json: string | null | undefined): Record<string, number> {
  try {
    const obj = JSON.parse(json ?? "{}");
    const out: Record<string, number> = {};
    if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function parseObjectOverrides(json: string | null | undefined): Record<string, unknown> {
  try {
    const obj = JSON.parse(json ?? "{}");
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function serializeOverrides(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

/**
 * Effective feature/limit access for a restaurant given its plan + overrides.
 * STAR uses the ALL_CURRENT_FEATURES marker: any feature later added to the
 * catalog is automatically available to Star customers.
 */
export async function getEffectiveAccess(restaurant: RestaurantAccessInput): Promise<EffectiveAccess> {
  const planId = restaurant.plan && isPlanId(restaurant.plan) ? restaurant.plan : "STAR";

  let featureKeys: string[] | null = null;
  let limits: Record<string, number> | null = null;

  const row = await prisma.plan.findUnique({ where: { id: planId } });
  if (row && row.isActive) {
    featureKeys = parseFeatureKeys(row.featureKeys);
    limits = parseLimitKeys(row.limitKeys);
  }

  if (featureKeys === null) {
    const def = DEFAULT_PLAN_CONFIGS[planId];
    featureKeys = def.features;
    limits = def.limits;
  }

  const base = new Set(featureKeys.includes(ALL_FEATURES_MARKER) ? ALL_FEATURE_KEYS : featureKeys);

  const features: Record<string, boolean> = {};
  for (const key of ALL_FEATURE_KEYS) features[key] = base.has(key);

  const featureOverrides = parseObjectOverrides(restaurant.featureOverrides);
  for (const [key, value] of Object.entries(featureOverrides)) {
    if (ALL_FEATURE_KEYS.includes(key) && typeof value === "boolean") features[key] = value;
  }

  const limitOverrides = parseObjectOverrides(restaurant.limitOverrides);
  const effectiveLimits: Record<string, number> = { ...(limits ?? {}) };
  for (const [key, value] of Object.entries(limitOverrides)) {
    if (typeof value === "number" && Number.isFinite(value)) effectiveLimits[key] = value;
  }

  return {
    plan: planId,
    isStar: restaurant.starNumber != null,
    starNumber: restaurant.starNumber ?? null,
    features,
    limits: effectiveLimits,
  };
}

export function hasFeature(access: EffectiveAccess, feature: string): boolean {
  return access.features[feature] === true;
}

export function canOrder(access: EffectiveAccess): boolean {
  return hasFeature(access, "ordering");
}

export function canBook(access: EffectiveAccess, bookingsEnabled: boolean): boolean {
  return hasFeature(access, "bookings") && bookingsEnabled;
}

/** Effective QR-table ceiling = plan limit (+ customer override). */
export function effectiveTableLimit(access: EffectiveAccess): number {
  const limit = access.limits["qrTables"];
  return typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
}

export interface RestaurantOpInput {
  id: string;
  name: string;
  isActive: boolean;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: Date | string | null;
  neverExpires: boolean;
  autoOff: boolean;
}

function isSubscriptionExpired(r: Pick<RestaurantOpInput, "neverExpires" | "subscriptionExpiresAt">): boolean {
  if (r.neverExpires || !r.subscriptionExpiresAt) return false;
  return new Date(r.subscriptionExpiresAt).getTime() < Date.now();
}

/**
 * Whether the restaurant is operational today. An expired subscription only
 * disables the restaurant when auto-off is ON; with auto-off OFF the restaurant
 * keeps running (the Super Admin dashboard still reports it as expired).
 */
export function subscriptionOperational(r: Pick<RestaurantOpInput, "subscriptionStatus" | "neverExpires" | "subscriptionExpiresAt" | "autoOff">): boolean {
  if (r.subscriptionStatus && r.subscriptionStatus !== "ACTIVE") return false;
  if (r.neverExpires) return true;
  if (isSubscriptionExpired(r)) return !r.autoOff;
  return true;
}

export function isRestaurantOperational(r: RestaurantOpInput): boolean {
  return Boolean(r.isActive && subscriptionOperational(r));
}

/**
 * Lazy auto-off enforcement: when a subscription has passed its expiry and
 * auto-off is ON, deactivate the restaurant on the next visit so access is
 * actually revoked (and the dashboard reflects it) without needing a cron job.
 */
export async function enforceSubscriptionState(r: RestaurantOpInput): Promise<"auto_off" | "grace" | "ok"> {
  if (!isSubscriptionExpired(r)) return "ok";
  if (r.autoOff && r.isActive) {
    await prisma.restaurant.update({
      where: { id: r.id },
      data: { isActive: false, subscriptionStatus: "EXPIRED" },
    });
    await logActivity("subscription_auto_off", {
      restaurantId: r.id,
      restaurantName: r.name,
      detail: "Auto-off triggered after subscription expiration",
    });
    return "auto_off";
  }
  return "grace";
}

/** Robust fetch used by guards/pages that need to evaluate operational state. */
export async function loadOperationalRestaurant(id: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      isActive: true,
      plan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      neverExpires: true,
      autoOff: true,
      featureOverrides: true,
      limitOverrides: true,
      starNumber: true,
      bookingsEnabled: true,
    },
  });
  if (!restaurant) return null;
  const op = {
    id: restaurant.id,
    name: restaurant.name,
    isActive: restaurant.isActive,
    subscriptionStatus: restaurant.subscriptionStatus,
    subscriptionExpiresAt: restaurant.subscriptionExpiresAt,
    neverExpires: restaurant.neverExpires,
    autoOff: restaurant.autoOff,
  };
  await enforceSubscriptionState(op);
  return restaurant;
}