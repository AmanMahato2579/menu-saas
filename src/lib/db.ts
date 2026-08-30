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

export async function getOrCreateActiveSession(tableId: string, restaurantId: string) {
  const existing = await prisma.tableSession.findFirst({
    where: { tableId, restaurantId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
  });
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
    quantity: number;
    isSpicy: boolean;
    note: string;
  }[];
}

export async function createOrder(input: CreateOrderInput) {
  const { restaurantId, tableSessionId, customerToken, items } = input;

  // 1. Validate all menu items belong to this restaurant and are available
  const menuItemIds = items.map((i) => i.menuItemId);
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

  let subtotalSum = new Prisma.Decimal(0);
  const orderItemsData = items.map((item) => {
    const menuItem = menuItemMap.get(item.menuItemId)!;
    const basePrice = menuItem.price;
    const discountMultiplier = new Prisma.Decimal(100 - menuItem.discountPercent).div(100);
    const unitPrice = basePrice.mul(discountMultiplier);
    const subtotal = unitPrice.mul(item.quantity);
    subtotalSum = subtotalSum.add(subtotal);
    return {
      menuItemId: item.menuItemId,
      menuItemName: menuItem.name,
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

  const { subtotal, taxAmount, total } = orders.reduce(
    (acc: any, order: any) => ({
      subtotal: acc.subtotal + parseFloat(order.subtotal?.toString() || "0"),
      taxAmount: acc.taxAmount + parseFloat(order.taxAmount?.toString() || "0"),
      total: acc.total + parseFloat(order.total?.toString() || "0"),
    }),
    { subtotal: 0, taxAmount: 0, total: 0 }
  );

  return { orders, subtotal, taxAmount, total };
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
