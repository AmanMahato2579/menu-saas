import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "Settings – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireRestaurantAdmin();
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: user.restaurantId! },
  });

  if (!restaurant) return <div>Restaurant not found.</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Restaurant Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Update your restaurant information
        </p>
      </div>
      <SettingsClient restaurant={JSON.parse(JSON.stringify(restaurant))} />
    </div>
  );
}
