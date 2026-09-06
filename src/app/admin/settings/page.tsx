import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "Settings – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireRestaurantAdmin();
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: user.restaurantId! },
  });

  if (!restaurant) return <div>Restaurant not found.</div>;
  const lang = restaurant.language;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t(lang, "Restaurant Settings", "रेस्टुरेन्ट सेटिङहरू")}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {t(lang, "Update your restaurant information", "आफ्नो रेस्टुरेन्टको जानकारी अपडेट गर्नुहोस्")}
        </p>
      </div>
      <SettingsClient restaurant={JSON.parse(JSON.stringify(restaurant))} />
    </div>
  );
}
