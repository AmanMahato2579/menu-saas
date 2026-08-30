import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { getAdminOrders } from "@/lib/db";
import OrdersClient from "./OrdersClient";

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export const metadata = { title: "Orders – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await requireRestaurantAdmin();
  const orders = await getAdminOrders(user.restaurantId!, params.status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage and update order statuses
        </p>
      </div>
      <OrdersClient
        orders={JSON.parse(JSON.stringify(orders))}
        currentStatus={params.status}
        restaurantId={user.restaurantId!}
      />
    </div>
  );
}
