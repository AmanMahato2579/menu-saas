// Pure plan catalog — feature keys, limits, defaults and display styles.
// Importable from both client and server code (no Prisma / I/O here).
//
// Design notes:
// - GOLD is intentionally absent from PLAN_IDS / DEFAULT_PLAN_CONFIGS. The
//   architecture supports it later (add a Plan row + flip isVisible) without
//   touching this catalog or the database schema.
// - STAR uses the ALL_CURRENT_FEATURES marker so every feature added to
//   FEATURE_CATALOG is automatically granted to Star customers.

export interface FeatureDef {
  key: string;
  label: string;
  group: "menu" | "ordering" | "operations";
}

export const FEATURE_CATALOG: FeatureDef[] = [
  { key: "restaurant_profile", label: "Restaurant profile", group: "menu" },
  { key: "digital_menu", label: "Digital menu", group: "menu" },
  { key: "menu_management", label: "Menu management", group: "menu" },
  { key: "qr_tables", label: "QR tables", group: "menu" },
  { key: "ordering", label: "QR ordering", group: "ordering" },
  { key: "table_ordering", label: "Table ordering", group: "ordering" },
  { key: "order_management", label: "Order management", group: "ordering" },
  { key: "kitchen_workflow", label: "Kitchen / order workflow", group: "ordering" },
  { key: "order_history", label: "Order history", group: "ordering" },
  { key: "bookings", label: "Bookings", group: "operations" },
];

/** Special marker stored in Plan.featureKeys meaning "every current + future feature". */
export const ALL_FEATURES_MARKER = "ALL_CURRENT_FEATURES";

export const ALL_FEATURE_KEYS = FEATURE_CATALOG.map((f) => f.key);

export const FEATURE_GROUPS: { key: FeatureDef["group"]; label: string }[] = [
  { key: "menu", label: "Menu & Profile" },
  { key: "ordering", label: "Ordering" },
  { key: "operations", label: "Operations" },
];

export interface LimitDef {
  key: string;
  label: string;
}

export const LIMIT_CATALOG: LimitDef[] = [{ key: "qrTables", label: "Maximum QR tables" }];

export const PLAN_IDS = ["BRONZE", "SILVER", "STAR"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanDefaults {
  features: string[];
  limits: Record<string, number>;
}

export const DEFAULT_PLAN_CONFIGS: Record<PlanId, PlanDefaults> = {
  BRONZE: {
    features: ["restaurant_profile", "digital_menu", "menu_management", "qr_tables"],
    limits: { qrTables: 10 },
  },
  SILVER: {
    features: [
      "restaurant_profile",
      "digital_menu",
      "menu_management",
      "qr_tables",
      "ordering",
      "table_ordering",
      "order_management",
      "kitchen_workflow",
      "order_history",
    ],
    limits: { qrTables: 20 },
  },
  STAR: { features: [ALL_FEATURES_MARKER], limits: { qrTables: 50 } },
};

export function isPlanId(value: string | null | undefined): value is PlanId {
  return value != null && (PLAN_IDS as readonly string[]).includes(value);
}

export interface PlanStyleVariant {
  badge: string;
  label: string;
}

/** Keeps the Smile/Star -> purple visual. Unknown/legacy plans fall back to Star styling. */
export function planStyleVariant(plan: string | null | undefined): PlanStyleVariant {
  if (plan === "BRONZE") {
    return {
      badge: "bg-orange-800/40 text-orange-300 border border-orange-700/40",
      label: "BRONZE",
    };
  }
  if (plan === "SILVER") {
    return {
      badge: "bg-gray-400/20 text-gray-300 border border-gray-500/40",
      label: "SILVER",
    };
  }
  return {
    badge: "bg-purple-500/20 text-purple-300 border border-purple-500/40",
    label: "STAR",
  };
}

export function planBadgeText(plan: string | null | undefined): string {
  if (plan === "BRONZE") return "Bronze";
  if (plan === "SILVER") return "Silver";
  return "Star";
}

/** Lightweight subscription state descriptor for dashboards/lists. Server-computed inputs stay in plans.ts. */
export type SubscriptionKind =
  | "never_expires"
  | "active"
  | "expiring_soon"
  | "expired"
  | "grace"
  | "suspended"
  | "cancelled"
  | "inactive";

export interface SubscriptionDescriptor {
  kind: SubscriptionKind;
  label: string;
  badge: string;
}

export function describeSubscriptionState(input: {
  kind: SubscriptionKind;
  daysRemaining?: number | null;
}): SubscriptionDescriptor {
  const base: Record<SubscriptionKind, { label: string; badge: string }> = {
    never_expires: { label: "Never expires", badge: "bg-green-500/20 text-green-400 border border-green-500/40" },
    active: { label: "Active", badge: "bg-green-500/20 text-green-400 border border-green-500/40" },
    expiring_soon: { label: "Expiring soon", badge: "bg-amber-500/20 text-amber-300 border border-amber-500/40" },
    expired: { label: "Expired", badge: "bg-red-500/20 text-red-400 border border-red-500/40" },
    grace: { label: "Expired · auto-off off", badge: "bg-amber-500/20 text-amber-300 border border-amber-500/40" },
    suspended: { label: "Suspended", badge: "bg-red-500/20 text-red-400 border border-red-500/40" },
    cancelled: { label: "Cancelled", badge: "bg-gray-500/20 text-gray-400 border border-gray-500/40" },
    inactive: { label: "Inactive", badge: "bg-red-500/20 text-red-400 border border-red-500/40" },
  };
  const entry = base[input.kind] ?? base.active;
  return {
    kind: input.kind,
    label: input.daysRemaining != null && input.kind === "expiring_soon" ? `${entry.label} (${input.daysRemaining}d)` : entry.label,
    badge: entry.badge,
  };
}