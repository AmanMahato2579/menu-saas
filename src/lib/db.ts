import { prisma } from "@/lib/prisma";
import { Prisma, OrderStatus, OrderItemStatus } from "@prisma/client";
import { createNotification } from "@/lib/notifications";
import { newOrderMessage, newOrderTitle, newTableSessionMessage, newTableSessionTitle } from "@/lib/i18n";

// Completed/Rejected order history is retained for exactly 24 hours.
// Retention is anchored to statusChangedAt (the moment the order reached its
// final COMPLETED / REJECTED status) rather than createdAt, so the window
// starts from the status change, as required.
export const ORDER_HISTORY_RETENTION_HOURS = 24;

function retentionCutoff(): Date {
  return new Date(Date.now() - ORDER_HISTORY_RETENTION_HOURS * 60 * 60 * 1000);
}

// ─── Restaurant queries ───────────────────────────────────────────────────────

export async function getRestaurantBySlug(slug: string) {
  return prisma.restaurant.findUnique({
    where: { slug },
  });
}

export async function getRestaurantById(id: string) {
  return prisma.restaurant.findUnique({
    where: { id },
  });
}

// ─── Table queries ────────────────────────────────────────────────────────────

export async function getTableByToken(qrToken: string) {
  return prisma.table.findUnique({
    where: { qrToken },
    include: { restaurant: true },
  });
}

export async function getActiveSession(tableId: string, restaurantId: string) {
  return prisma.tableSession.findFirst({
    where: { tableId, restaurantId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
  });
}

/** A session is deliberately created only after the guest presses Start. */
export async function startTableSession(tableId: string, restaurantId: string, customerName?: string) {
  const existing = await getActiveSession(tableId, restaurantId);
  if (existing) return existing;

  const session = await prisma.tableSession.create({
    data: { tableId, restaurantId, status: "ACTIVE", customerName: customerName?.trim() || null },
  });

  // Notify the restaurant admin that a customer scanned the QR code
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    select: { tableNumber: true, restaurant: { select: { language: true } } },
  });
  const lang = table?.restaurant?.language ?? "EN";
  await createNotification({
    restaurantId,
    type: "NEW_TABLE_SESSION",
    title: newTableSessionTitle(lang),
    message: newTableSessionMessage(lang, session.customerName, table?.tableNumber),
    link: "/admin/tables",
  });

  return session;
}

/** Waiter-opened session (walk-in / verbal order). No customer-arrival alert. */
export async function ensureTableSession(tableId: string, restaurantId: string) {
  const existing = await getActiveSession(tableId, restaurantId);
  if (existing) return existing;
  return prisma.tableSession.create({
    data: { tableId, restaurantId, status: "ACTIVE" },
  });
}

// ─── Menu queries ─────────────────────────────────────────────────────────────

export async function getPublicMenu(restaurantId: string) {
  return prisma.category.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { createdAt: "asc" },
    include: {
      menuItems: {
        where: { restaurantId, isAvailable: true },
        orderBy: { createdAt: "asc" },
        include: { variants: { where: { isAvailable: true }, orderBy: { createdAt: "asc" } } },
      },
    },
  });
}

// ─── Order queries ────────────────────────────────────────────────────────────

export async function getNextOrderNumber(restaurantId: string): Promise<number> {
  const seq = await prisma.orderSequence.upsert({
    where: { restaurantId },
    update: { lastNumber: { increment: 1 } },
    create: { restaurantId, lastNumber: 1001 },
  });
  return seq.lastNumber;
}

export interface NewOrderInputItem {
  menuItemId: string;
  variantId?: string | null;
  quantity: number;
  isSpicy?: boolean;
  note?: string;
}

export interface CreateOrderInput {
  restaurantId: string;
  tableSessionId: string;
  customerToken: string;
  items: NewOrderInputItem[];
}

/**
 * Resolve menu items/variants (tenant-safe), apply server-side pricing and
 * build OrderItem create rows. Shared by the customer and waiter order paths so
 * both always derive prices from the exact same menu catalogue.
 */
async function buildOrderItems(restaurantId: string, items: NewOrderInputItem[]) {
  const menuItemIds = [...new Set(items.map((i) => i.menuItemId))];
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      restaurantId, // tenant isolation
      isAvailable: true,
    },
  });

  if (!menuItems.length || menuItems.length !== menuItemIds.length) {
    throw new Error("One or more items are unavailable or invalid.");
  }

  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));
  const variantIds = items.flatMap((item) => (item.variantId ? [item.variantId] : []));
  const variants = variantIds.length
    ? await prisma.menuItemVariant.findMany({
        where: { id: { in: variantIds }, isAvailable: true },
      })
    : [];
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

  const builds = items.map((item) => {
    const menuItem = menuItemMap.get(item.menuItemId);
    if (!menuItem) throw new Error("One or more items are unavailable or invalid.");
    const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
    if (item.variantId && (!variant || variant.menuItemId !== menuItem.id)) {
      throw new Error("One or more item variants are unavailable or invalid.");
    }
    const basePrice = variant?.price ?? menuItem.price;
    const discountMultiplier = new Prisma.Decimal(100 - menuItem.discountPercent).div(100);
    const unitPrice = basePrice.mul(discountMultiplier);
    const subtotal = unitPrice.mul(item.quantity);
    return {
      menuItem: { requiresPreparation: menuItem.requiresPreparation },
      data: {
        menuItemId: item.menuItemId,
        menuItemName: menuItem.name,
        menuItemVariantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
        quantity: item.quantity,
        unitPrice,
        subtotal,
        isSpicy: item.isSpicy && menuItem.hasSpicyOption,
        note: item.note,
      },
    };
  });

  const subtotalSum = builds.reduce((sum, b) => sum.add(b.data.subtotal), new Prisma.Decimal(0));
  return { builds, subtotalSum };
}

async function computeTax(subtotal: Prisma.Decimal, restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { isTaxEnabled: true, taxRate: true },
  });
  if (restaurant?.isTaxEnabled && restaurant.taxRate) {
    return subtotal.mul(restaurant.taxRate).div(100);
  }
  return new Prisma.Decimal(0);
}

export async function createOrder(input: CreateOrderInput) {
  const { restaurantId, tableSessionId, customerToken, items } = input;
  const session = await prisma.tableSession.findFirst({
    where: { id: tableSessionId, restaurantId, status: "ACTIVE" },
  });
  if (!session) throw new Error("Invalid or expired session.");

  const { builds, subtotalSum } = await buildOrderItems(restaurantId, items);
  const taxAmount = await computeTax(subtotalSum, restaurantId);
  const total = subtotalSum.add(taxAmount);

  const orderNumber = await getNextOrderNumber(restaurantId);

  const order = await prisma.order.create({
    data: {
      orderNumber,
      restaurantId,
      tableSessionId,
      customerToken,
      source: "CUSTOMER",
      subtotal: subtotalSum,
      taxAmount,
      total,
      orderItems: {
        create: builds.map((b) => b.data),
      },
    },
    include: {
      orderItems: true,
      tableSession: { include: { table: true } },
    },
  });

  const tableNumber = order.tableSession?.table?.tableNumber;
  const itemSummary = order.orderItems
    .map((i) => `${i.menuItemName} ×${i.quantity}`)
    .join(", ");
  const lang = (await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { language: true } }))?.language ?? "EN";
  await createNotification({
    restaurantId,
    type: "NEW_ORDER",
    title: newOrderTitle(lang, orderNumber),
    message: newOrderMessage(lang, { orderNumber, tableNumber, itemSummary }),
    link: `/admin/orders?sessionId=${tableSessionId}&orderId=${order.id}`,
  });

  return order;
}

interface WaiterOrderInput {
  restaurantId: string;
  tableId: string;
  items: NewOrderInputItem[];
}

/**
 * Waiter/owner verbal order. Joins the table's active session (opening one if
 * the table is sitting empty) and creates an immediately-actionable order:
 * items that need preparation start as NEW, instant-service items are marked
 * SERVED right away. The waiter never has to accept their own order.
 */
export async function createWaiterOrder(input: WaiterOrderInput) {
  const { restaurantId, tableId, items } = input;
  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId, isActive: true },
  });
  if (!table) throw new Error("Table not found.");

  const session = await ensureTableSession(tableId, restaurantId);

  const { builds, subtotalSum } = await buildOrderItems(restaurantId, items);
  const taxAmount = await computeTax(subtotalSum, restaurantId);
  const total = subtotalSum.add(taxAmount);
  const orderNumber = await getNextOrderNumber(restaurantId);

  const order = await prisma.order.create({
    data: {
      orderNumber,
      restaurantId,
      tableSessionId: session.id,
      customerToken: "waiter",
      source: "WAITER",
      status: "ACCEPTED",
      subtotal: subtotalSum,
      taxAmount,
      total,
      orderItems: {
        create: builds.map((b) => {
          const instant = !b.menuItem.requiresPreparation;
          return {
            ...b.data,
            status: instant ? "SERVED" : "NEW",
            servedQuantity: instant ? b.data.quantity : 0,
          };
        }),
      },
    },
    include: {
      orderItems: true,
      tableSession: { include: { table: true } },
    },
  });

  return order;
}

export async function getOrdersBySession(tableSessionId: string, restaurantId: string) {
  return prisma.order.findMany({
    where: { tableSessionId, restaurantId },
    include: { orderItems: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getOrdersByCustomerToken(customerToken: string, restaurantId: string) {
  return prisma.order.findMany({
    where: { customerToken, restaurantId },
    include: {
      orderItems: true,
      tableSession: { include: { table: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateOrderStatus(
  orderId: string,
  restaurantId: string,
  status: OrderStatus
) {
  return prisma.order.update({
    where: { id: orderId, restaurantId }, // ensures tenant isolation
    data: { status, statusChangedAt: new Date() },
  });
}

// ─── Per-item status & quantity ───────────────────────────────────────────────

const ORDER_ITEM_WITH_CONTEXT = {
  include: {
    menuItem: { select: { requiresPreparation: true } },
    order: {
      select: {
        id: true,
        status: true,
        source: true,
        restaurantId: true,
        tableSession: { select: { id: true, status: true } },
      },
    },
  },
} as const;

async function findOrderItem(itemId: string, restaurantId: string) {
  return prisma.orderItem.findFirst({
    where: { id: itemId, order: { restaurantId } },
    ...ORDER_ITEM_WITH_CONTEXT,
  });
}

/**
 * Apply the operational item lifecycle. NEW → PREPARING → SERVED with
 * cancellation support. Instant-service items (requiresPreparation=false) can
 * jump NEW → SERVED. SERVED and CANCELLED items are terminal.
 */
export async function setOrderItemStatus(
  itemId: string,
  restaurantId: string,
  status: OrderItemStatus,
  reason?: string
) {
  const item = await findOrderItem(itemId, restaurantId);
  if (!item) throw Object.assign(new Error("Item not found"), { code: "NOT_FOUND" });

  if (status === item.status) return item;

  if (item.status === "SERVED" || item.status === "CANCELLED") {
    throw Object.assign(new Error("This item cannot be changed anymore."), { code: "TERMINAL" });
  }

  // A customer-submitted order must first be accepted by staff before it can
  // start cooking (waiter orders are created ACCEPTED so this never blocks
  // them). Cancelling an item is always allowed — even before acceptance.
  if (item.order.status === "PENDING" && status !== "CANCELLED") {
    throw Object.assign(new Error("Accept the order first."), { code: "PENDING_ORDER" });
  }

  const terminal = item.status;
  const isInstant = !item.menuItem.requiresPreparation;
  const allowed =
    terminal === "NEW" &&
    (status === "PREPARING" || status === "CANCELLED" || (status === "SERVED" && isInstant));
  const preparingToServed = terminal === "PREPARING" && status === "SERVED";
  const preparingToCancelled = terminal === "PREPARING" && status === "CANCELLED";

  if (!allowed && !preparingToServed && !preparingToCancelled) {
    throw Object.assign(new Error("Invalid status change."), { code: "INVALID_TRANSITION" });
  }

  const data: Prisma.OrderItemUpdateInput =
    status === "SERVED"
      ? { status, servedQuantity: item.quantity }
      : { status, cancelledReason: reason?.trim() || null };

  const updated = await prisma.orderItem.update({ where: { id: itemId }, data });
  await recomputeOrderTotals(item.order.id, restaurantId);
  return updated;
}

/**
 * Serve one more portion of an item (partial serving). Instant items jump to
 * fully SERVED on the first serve. The database remains the source of truth
 * via servedQuantity.
 */
export async function serveOrderItem(itemId: string, restaurantId: string, increment = 1) {
  const item = await findOrderItem(itemId, restaurantId);
  if (!item) throw Object.assign(new Error("Item not found"), { code: "NOT_FOUND" });

  if (item.status === "SERVED") return item;
  if (item.status === "CANCELLED") {
    throw Object.assign(new Error("This item is cancelled."), { code: "TERMINAL" });
  }
  if (item.order.status === "PENDING") {
    throw Object.assign(new Error("Accept the order first."), { code: "PENDING_ORDER" });
  }

  const isInstant = !item.menuItem.requiresPreparation;
  if (isInstant) {
    const updated = await prisma.orderItem.update({
      where: { id: itemId },
      data: { status: "SERVED", servedQuantity: item.quantity },
    });
    return updated;
  }

  const servedQuantity = Math.min(item.servedQuantity + Math.max(1, increment), item.quantity);
  const fullyServed = servedQuantity >= item.quantity;
  const updated = await prisma.orderItem.update({
    where: { id: itemId },
    data: {
      servedQuantity,
      status: fullyServed ? "SERVED" : item.status === "NEW" ? "PREPARING" : item.status,
    },
  });
  return updated;
}

/**
 * Change quantity of an item before it is fully served. NEW items can be
 * increased or reduced; PREPARING items may only be reduced (still cookable).
 * A reduction cannot go below what has already been served (there must always
 * be at least one portion left owed to the customer — removing the last
 * portion is done via Cancel).
 */
export async function setOrderItemQuantity(itemId: string, restaurantId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw Object.assign(new Error("Quantity must be at least 1."), { code: "INVALID_QUANTITY" });
  }

  const item = await findOrderItem(itemId, restaurantId);
  if (!item) throw Object.assign(new Error("Item not found"), { code: "NOT_FOUND" });

  if (item.status === "SERVED" || item.status === "CANCELLED") {
    throw Object.assign(new Error("This item has already been served or removed."), { code: "TERMINAL" });
  }

  const portion = Math.min(item.servedQuantity || 0, item.quantity);
  const minQuantity = Math.min(Math.max(portion + 1, 1), item.quantity);

  if (quantity < minQuantity) {
    throw Object.assign(
      new Error(
        `Quantity cannot be reduced below ${minQuantity} — remove the item instead.`
      ),
      { code: "INVALID_QUANTITY" }
    );
  }

  // Once cooking starts you cannot add to an item; create a new line instead.
  if (item.status === "PREPARING" && quantity > item.quantity) {
    throw Object.assign(
      new Error("This item is already cooking — add a new item instead."),
      { code: "NOT_EDITABLE" }
    );
  }

  const unitPrice = new Prisma.Decimal(item.unitPrice);
  const updated = await prisma.orderItem.update({
    where: { id: itemId },
    data: { quantity, subtotal: unitPrice.mul(quantity) },
  });
  await recomputeOrderTotals(item.order.id, restaurantId);
  return updated;
}

/** Recompute an order's stored totals from its live (non-cancelled) items. */
async function recomputeOrderTotals(orderId: string, restaurantId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: { orderItems: true, tableSession: { select: { applyTax: true } } },
  });
  if (!order) return;

  const subtotal = order.orderItems
    .filter((i) => i.status !== "CANCELLED")
    .reduce((sum, i) => sum.add(new Prisma.Decimal(i.subtotal)), new Prisma.Decimal(0));

  const taxAmount = new Prisma.Decimal(0);
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { isTaxEnabled: true, taxRate: true },
  });
  if (restaurant?.isTaxEnabled && restaurant.taxRate) {
    const tax = subtotal.mul(restaurant.taxRate).div(100);
    await prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        taxAmount: tax,
        total: subtotal.add(tax),
      },
    });
    return;
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { subtotal, taxAmount, total: subtotal },
  });
}

// ─── Session overview & billing ───────────────────────────────────────────────

/** Single active table session with its orders + full per-item status. */
export async function getSessionOverview(tableSessionId: string, restaurantId: string) {
  return prisma.tableSession.findFirst({
    where: { id: tableSessionId, restaurantId },
    include: {
      table: true,
      orders: {
        orderBy: { createdAt: "asc" },
        where: { status: { not: "REJECTED" } },
        include: { orderItems: { orderBy: { createdAt: "asc" }, include: { menuItem: { select: { requiresPreparation: true } } } } },
      },
    },
  });
}

/** All operational sessions for a restaurant (active + recently closed). */
export async function getAdminSessionOverview(restaurantId: string) {
  return prisma.tableSession.findMany({
    where: {
      restaurantId,
      OR: [
        { status: "ACTIVE" },
        {
          status: { not: "ACTIVE" },
          orders: { some: { statusChangedAt: { gte: retentionCutoff() } } },
        },
      ],
    },
    include: {
      table: true,
      orders: {
        orderBy: { createdAt: "asc" },
        where: { status: { not: "REJECTED" } },
        include: { orderItems: { orderBy: { createdAt: "asc" }, include: { menuItem: { select: { requiresPreparation: true } } } } },
      },
    },
    orderBy: { startedAt: "desc" },
  });
}

/**
 * Item-based session bill. Totals are computed from every NON-CANCELLED order
 * item in the session (served OR still preparing) — serving never removes an
 * item from the financial total unless the item was cancelled.
 */
export async function getSessionBill(tableSessionId: string, restaurantId: string) {
  const orders = await prisma.order.findMany({
    where: {
      tableSessionId,
      restaurantId,
      status: { notIn: ["REJECTED"] },
    },
    include: { orderItems: { orderBy: { createdAt: "asc" }, include: { menuItem: { select: { requiresPreparation: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  const subtotal = orders.reduce(
    (sum, order) =>
      sum +
      order.orderItems
        .filter((i) => i.status !== "CANCELLED")
        .reduce((s, i) => s + Number(i.subtotal), 0),
    0
  );

  const [restaurant, tableSession] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { isTaxEnabled: true, taxRate: true, isServiceChargeEnabled: true, serviceChargeRate: true },
    }),
    prisma.tableSession.findFirst({
      where: { id: tableSessionId, restaurantId },
      select: { applyTax: true, applyServiceCharge: true },
    }),
  ]);
  const taxAmount = restaurant?.isTaxEnabled && tableSession?.applyTax ? (subtotal * Number(restaurant.taxRate)) / 100 : 0;
  const serviceChargeAmount =
    restaurant?.isServiceChargeEnabled && tableSession?.applyServiceCharge
      ? (subtotal * Number(restaurant.serviceChargeRate)) / 100
      : 0;
  return { orders, subtotal, taxAmount, serviceChargeAmount, total: subtotal + taxAmount + serviceChargeAmount };
}

// ─── Admin queries ────────────────────────────────────────────────────────────

/** Server-side physical cleanup of expired history rows (COMPLETED/REJECTED). */
export async function cleanupExpiredOrderHistory(restaurantId?: string) {
  const cutoff = retentionCutoff();
  const where: Prisma.OrderWhereInput = {
    statusChangedAt: { lt: cutoff },
    status: { in: ["COMPLETED", "REJECTED"] },
  };
  if (restaurantId) where.restaurantId = restaurantId;

  // TableSession is intentionally NOT auto-deleted here: closing a session is
  // an explicit, money-related action. Only the completed/rejected orders that
  // have passed their retention are removed, keeping active sessions intact.
  const result = await prisma.order.deleteMany({ where });
  return result.count;
}

export async function getDashboardStats(restaurantId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayOrders, pendingCount, preparingItems, activeTables, totalTables, todaySessions] = await Promise.all([
    prisma.order.count({
      where: { restaurantId, createdAt: { gte: today } },
    }),
    prisma.order.count({ where: { restaurantId, status: "PENDING" } }),
    prisma.orderItem.count({
      where: { status: "PREPARING", order: { restaurantId, status: { not: "REJECTED" } } },
    }),
    prisma.tableSession.count({ where: { restaurantId, status: "ACTIVE" } }),
    prisma.table.count({ where: { restaurantId, isActive: true } }),
    prisma.tableSession.count({
      where: { restaurantId, startedAt: { gte: today } },
    }),
  ]);

  const itemsToday = await prisma.orderItem.findMany({
    where: {
      createdAt: { gte: today },
      order: { restaurantId, status: { notIn: ["REJECTED"] } },
    },
    select: { status: true, subtotal: true },
  });

  const servedToday = itemsToday.filter((i) => i.status === "SERVED").length;
  const todaySales = itemsToday
    .filter((i) => i.status !== "CANCELLED")
    .reduce((sum, i) => sum + Number(i.subtotal), 0);

  return {
    todayOrders,
    pendingCount,
    preparingItems,
    servedToday,
    activeTables,
    totalTables,
    todaySessions,
    todaySales,
  };
}