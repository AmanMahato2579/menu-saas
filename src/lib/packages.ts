// Pure onboarding packages for the super admin. Each package maps to a billing
// plan, a default subscription length and per-restaurant feature overrides so
// the store owner gets exactly what was sold. Importable from client and server.
import type { PlanId } from "@/lib/plan-catalog";

export const PACKAGE_IDS = ["menu_view", "menu_order", "restaurant_full"] as const;
export type PackageId = (typeof PACKAGE_IDS)[number];

export interface MenuQrPackage {
  id: PackageId;
  name: string;
  shortName: string;
  tagline: string;
  priceLine: string;
  priceNote: string;
  billing: "standard" | "custom";
  points: string[];
  plan: PlanId;
  featureOff: string[];
  defaultDays: number;
  contact: boolean;
}

export const PACKAGES: MenuQrPackage[] = [
  {
    id: "menu_view",
    name: "QR menu (view only)",
    shortName: "View menu",
    tagline: "Show the menu on every table",
    priceLine: "Menu only",
    priceNote: "view-only QR",
    billing: "standard",
    points: ["Digital menu with live prices", "QR codes for every table", "Update items & availability anytime"],
    plan: "BRONZE",
    featureOff: ["ordering", "table_ordering", "order_management", "kitchen_workflow", "order_history", "bookings"],
    defaultDays: 365,
    contact: false,
  },
  {
    id: "menu_order",
    name: "QR menu + ordering",
    shortName: "Menu + Order",
    tagline: "Guests order straight from their table",
    priceLine: "Menu + Order",
    priceNote: "per agreement",
    billing: "standard",
    points: ["Everything in view-only menu", "Customer ordering & cart", "Kitchen and waiter order flow", "Billing and order history"],
    plan: "SILVER",
    featureOff: [],
    defaultDays: 365,
    contact: false,
  },
  {
    id: "restaurant_full",
    name: "Full restaurant",
    shortName: "Full restaurant",
    tagline: "Ordering, bookings and the complete workflow",
    priceLine: "Contact us",
    priceNote: "custom setup",
    billing: "custom",
    points: ["Everything in Menu + Order", "Bookable services and reservations", "Founding-partner eligible", "Priority feature rollout"],
    plan: "STAR",
    featureOff: [],
    defaultDays: 365,
    contact: true,
  },
];

export function findPackage(id: string | null | undefined): MenuQrPackage | undefined {
  if (!id) return undefined;
  return PACKAGES.find((p) => p.id === id);
}
