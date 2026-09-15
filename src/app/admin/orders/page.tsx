import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { getAdminSessionOverview, getRestaurantById } from "@/lib/db";
import { t } from "@/lib/i18n";
import OrdersClient from "./OrdersClient";

export const metadata = { title: "Orders & Checkout – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await requireRestaurantAdmin();
  const [sessions, restaurant] = await Promise.all([
    getAdminSessionOverview(user.restaurantId!),
    getRestaurantById(user.restaurantId!),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t(restaurant?.language, "Orders & Table Checkout", "अर्डर र टेबल चेकआउट")}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {t(restaurant?.language, "Manage kitchen orders and perform 1-click table checkout", "किचन अर्डर व्यवस्थापन गर्नुहोस् र एक-क्लिक टेबल चेकआउट गर्नुहोस्")}
        </p>
      </div>
      <OrdersClient
        sessions={JSON.parse(JSON.stringify(sessions))}
        restaurant={JSON.parse(JSON.stringify(restaurant))}
      />
    </div>
  );
}