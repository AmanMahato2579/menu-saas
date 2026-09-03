import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { getAdminOrders, getRestaurantById } from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import OrdersClient from "./OrdersClient";

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export const metadata = { title: "Orders & Checkout – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await requireRestaurantAdmin();
  const [orders, restaurant] = await Promise.all([
    getAdminOrders(user.restaurantId!, params.status as OrderStatus | undefined),
    getRestaurantById(user.restaurantId!),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders & Table Checkout</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage kitchen orders and perform 1-click table checkout
        </p>
      </div>
      <OrdersClient
        orders={JSON.parse(JSON.stringify(orders))}
        currentStatus={params.status}
        restaurantId={user.restaurantId!}
        restaurant={JSON.parse(JSON.stringify(restaurant))}
      />
    </div>
  );
}
