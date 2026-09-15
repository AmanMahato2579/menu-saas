import type { OrderItemStatus } from "@prisma/client";

// Shared pure helpers for the item-based table session model. Safe to import
// from client components (no server-only dependencies).

export interface SessionOrderItem {
  id: string;
  menuItemName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  isSpicy: boolean;
  note: string | null;
  status: OrderItemStatus;
  servedQuantity: number;
  requiresPreparation?: boolean | null;
  /** Nested menuItem relation from server overviews — consumed by flatten. */
  menuItem?: { requiresPreparation?: boolean | null } | null;
}

export interface SessionOrder {
  id: string;
  orderNumber: number;
  status: string;
  source: string;
  createdAt: string;
  orderItems: SessionOrderItem[];
}

export interface SessionItem extends SessionOrderItem {
  orderId: string;
  orderNumber: number;
  orderStatus: string;
  orderSource: string;
}

export interface BillConfig {
  currency: string;
  isTaxEnabled: boolean;
  taxRate: number;
  isServiceChargeEnabled: boolean;
  serviceChargeRate: number;
  applyTax: boolean;
  applyServiceCharge: boolean;
}

export interface SessionBill {
  served: SessionItem[];
  preparing: SessionItem[];
  newItems: SessionItem[];
  cancelled: SessionItem[];
  subtotal: number;
  taxAmount: number;
  serviceChargeAmount: number;
  total: number;
  unservedCount: number;
  /** Non-cancelled items still owed to the customer. */
  activeCount: number;
}

export function flattenSessionOrders(orders: SessionOrder[] | undefined | null): SessionItem[] {
  const items: SessionItem[] = [];
  (orders ?? []).forEach((o) => {
    // Rejected orders are removed from the active session everywhere (bill,
    // kitchen view, customer) — acceptance denial is their "delete".
    if (o.status === "REJECTED") return;
    o.orderItems.forEach((i) => {
      items.push({
        ...i,
        requiresPreparation: i.menuItem?.requiresPreparation ?? i.requiresPreparation ?? null,
        orderId: o.id,
        orderNumber: o.orderNumber,
        orderStatus: o.status,
        orderSource: o.source,
      });
    });
  });
  return items;
}

export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  return 0;
}

export function computeBill(items: SessionItem[], cfg: BillConfig): SessionBill {
  const active = items.filter((i) => i.status !== "CANCELLED");
  const subtotal = active.reduce((s, i) => s + toNumber(i.subtotal), 0);
  const taxAmount =
    cfg.isTaxEnabled && cfg.applyTax ? (subtotal * Number(cfg.taxRate)) / 100 : 0;
  const serviceChargeAmount =
    cfg.isServiceChargeEnabled && cfg.applyServiceCharge
      ? (subtotal * Number(cfg.serviceChargeRate)) / 100
      : 0;
  const total = subtotal + taxAmount + serviceChargeAmount;

  const served = items.filter((i) => i.status === "SERVED");
  const preparing = items.filter((i) => i.status === "PREPARING");
  const newItems = items.filter((i) => i.status === "NEW");
  const cancelled = items.filter((i) => i.status === "CANCELLED");

  return {
    served,
    preparing,
    newItems,
    cancelled,
    subtotal,
    taxAmount,
    serviceChargeAmount,
    total,
    unservedCount: preparing.length + newItems.length,
    activeCount: served.length + preparing.length + newItems.length,
  };
}

/** Remaining quantity still owed (partial serving aware). */
export function remainingQuantity(item: SessionItem): number {
  return Math.max(0, item.quantity - (item.servedQuantity || 0));
}

export function isFullyServed(item: SessionItem): boolean {
  return item.status === "SERVED" || item.servedQuantity >= item.quantity;
}