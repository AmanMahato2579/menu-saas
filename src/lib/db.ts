import { prisma } from "@/lib/prisma";
import { Prisma, OrderStatus } from "@prisma/client";

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
    select: { tableNumber: true },
  });
  await prisma.notification.create({
    data: {
      restaurantId,
      type: "NEW_TABLE_SESSION",
      title: "Guest arrived — service needed",
      message: `${customerName?.trim() ? `${customerName.trim()} is` : "A guest is"} waiting at Table ${table?.tableNumber ?? tableId}. Please greet them.`,
      link: "/admin/tables",
    },
  });

  return session;
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

export interface CreateOrderInput {
  restaurantId: string;
  tableSessionId: string;
  customerToken: string;
  items: {
    menuItemId: string;
    variantId?: string | null;
    quantity: number;
    isSpicy: boolean;
    note: string;
  }[];
}

export async function createOrder(input: CreateOrderInput) {
  const { restaurantId, tableSessionId, customerToken, items } = input;

  // 1. Validate all menu items belong to this restaurant and are available
  const menuItemIds = [...new Set(items.map((i) => i.menuItemId))];
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      restaurantId, // tenant isolation
      isAvailable: true,
    },
  });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { isTaxEnabled: true, taxRate: true }
  });

  if (menuItems.length !== menuItemIds.length) {
    throw new Error("One or more items are unavailable or invalid.");
  }

  // 2. Build order items with server-side prices
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));
  const variantIds = items.flatMap((item) => item.variantId ? [item.variantId] : []);
  const variants = variantIds.length ? await prisma.menuItemVariant.findMany({
    where: { id: { in: variantIds }, isAvailable: true },
  }) : [];
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

  let subtotalSum = new Prisma.Decimal(0);
  const orderItemsData = items.map((item) => {
    const menuItem = menuItemMap.get(item.menuItemId)!;
    const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
    if (item.variantId && (!variant || variant.menuItemId !== menuItem.id)) {
      throw new Error("One or more item variants are unavailable or invalid.");
    }
    const basePrice = variant?.price ?? menuItem.price;
    const discountMultiplier = new Prisma.Decimal(100 - menuItem.discountPercent).div(100);
    const unitPrice = basePrice.mul(discountMultiplier);
    const subtotal = unitPrice.mul(item.quantity);
    subtotalSum = subtotalSum.add(subtotal);
    return {
      menuItemId: item.menuItemId,
      menuItemName: menuItem.name,
      menuItemVariantId: variant?.id,
      variantName: variant?.name,
      quantity: item.quantity,
      unitPrice,
      subtotal,
      isSpicy: item.isSpicy && menuItem.hasSpicyOption,
      note: item.note,
    };
  });

  let taxAmount = new Prisma.Decimal(0);
  if (restaurant?.isTaxEnabled && restaurant.taxRate) {
    taxAmount = subtotalSum.mul(restaurant.taxRate).div(100);
  }
  const total = subtotalSum.add(taxAmount);

  // 3. Get next order number
  const orderNumber = await getNextOrderNumber(restaurantId);

  // 4. Create order
  const order = await prisma.order.create({
    data: {
      orderNumber,
      restaurantId,
      tableSessionId,
      customerToken,
      subtotal: subtotalSum,
      taxAmount,
      total,
      orderItems: {
        create: orderItemsData,
      },
    },
    include: {
      orderItems: true,
      tableSession: {
        include: { table: true },
      },
    },
  });

  // Notify the restaurant admin of the new order
  const tableNumber = order.tableSession?.table?.tableNumber;
  const itemSummary = order.orderItems
    .map((i) => `${i.menuItemName} ×${i.quantity}`)
    .join(", ");
  await prisma.notification.create({
    data: {
      restaurantId,
      type: "NEW_ORDER",
      title: `New order #${orderNumber}`,
      message: tableNumber
        ? `Table ${tableNumber} — ${itemSummary}`
        : itemSummary,
      link: `/admin/orders?orderId=${order.id}`,
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
    data: { status },
  });
}

export async function getSessionBill(tableSessionId: string, restaurantId: string) {
  const orders = await prisma.order.findMany({
    where: {
      tableSessionId,
      restaurantId,
      status: { notIn: ["REJECTED"] },
    },
    include: { orderItems: true },
    orderBy: { createdAt: "asc" },
  });

  const subtotal = orders.reduce(
    (sum, order) => sum + Number(order.subtotal),
    0
  );

  const [restaurant, tableSession] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { isTaxEnabled: true, taxRate: true, isServiceChargeEnabled: true, serviceChargeRate: true } }),
    prisma.tableSession.findFirst({ where: { id: tableSessionId, restaurantId }, select: { applyTax: true, applyServiceCharge: true } }),
  ]);
  const taxAmount = restaurant?.isTaxEnabled && tableSession?.applyTax ? subtotal * Number(restaurant.taxRate) / 100 : 0;
  const serviceChargeAmount = restaurant?.isServiceChargeEnabled && tableSession?.applyServiceCharge ? subtotal * Number(restaurant.serviceChargeRate) / 100 : 0;
  return { orders, subtotal, taxAmount, serviceChargeAmount, total: subtotal + taxAmount + serviceChargeAmount };
}

// ─── Admin queries ────────────────────────────────────────────────────────────

export async function getAdminOrders(restaurantId: string, status?: OrderStatus) {
  return prisma.order.findMany({
    where: {
      restaurantId,
      ...(status ? { status } : {}),
    },
    include: {
      orderItems: true,
      tableSession: { include: { table: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDashboardStats(restaurantId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    todayOrders,
    pendingCount,
    acceptedCount,
    preparingCount,
    readyCount,
    completedCount,
    activeTables,
    todaySales,
  ] = await Promise.all([
    prisma.order.count({
      where: { restaurantId, createdAt: { gte: today } },
    }),
    prisma.order.count({ where: { restaurantId, status: "PENDING" } }),
    prisma.order.count({ where: { restaurantId, status: "ACCEPTED" } }),
    prisma.order.count({ where: { restaurantId, status: "PREPARING" } }),
    prisma.order.count({ where: { restaurantId, status: "READY" } }),
    prisma.order.count({
      where: { restaurantId, status: "COMPLETED", createdAt: { gte: today } },
    }),
    prisma.table.count({ where: { restaurantId, isActive: true } }),
    prisma.order.aggregate({
      where: {
        restaurantId,
        status: { in: ["ACCEPTED", "PREPARING", "READY", "COMPLETED"] },
        createdAt: { gte: today },
      },
      _sum: { total: true },
    }),
  ]);

  return {
    todayOrders,
    pendingCount,
    acceptedCount,
    preparingCount,
    readyCount,
    completedCount,
    activeTables,
    todaySales: todaySales._sum.total ?? 0,
  };
}
