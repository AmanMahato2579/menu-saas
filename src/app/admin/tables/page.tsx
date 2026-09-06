import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n";
import TablesClient from "./TablesClient";

export const metadata = { title: "Tables – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const user = await requireRestaurantAdmin();
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: user.restaurantId! },
  });
  const tables = await prisma.table.findMany({
    where: { restaurantId: user.restaurantId! },
    orderBy: { tableNumber: "asc" },
    include: {
      _count: {
        select: {
          tableSessions: { where: { status: "ACTIVE" } },
        },
      },
      tableSessions: { where: { status: "ACTIVE" }, select: { id: true, customerName: true, applyTax: true, applyServiceCharge: true } },
    },
  });

  const lang = restaurant?.language ?? "EN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t(lang, "Tables", "टेबलहरू")}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {t(lang, "Manage tables and generate QR codes for each table", "टेबलहरू व्यवस्थापन गर्नुहोस् र प्रत्येक टेबलको लागि QR कोड बनाउनुहोस्")}
        </p>
      </div>
      <TablesClient
        tables={JSON.parse(JSON.stringify(tables))}
        restaurantSlug={restaurant?.slug ?? ""}
        restaurantName={restaurant?.name ?? "Our Restaurant"}
        language={lang}
      />
    </div>
  );
}
