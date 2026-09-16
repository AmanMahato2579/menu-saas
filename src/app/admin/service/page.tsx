import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n";
import ServiceTables from "./ServiceTables";

export const metadata = { title: "Take Order – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function ServicePage() {
  const user = await requireRestaurantAdmin();
  const [restaurant, tables] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: user.restaurantId! },
    }),
    prisma.table.findMany({
      where: { restaurantId: user.restaurantId! },
      orderBy: { tableNumber: "asc" },
      include: {
        tableSessions: {
          where: { status: "ACTIVE" },
          orderBy: { startedAt: "desc" },
          take: 1,
          include: {
            orders: { include: { orderItems: { select: { status: true } } } },
          },
        },
      },
    }),
  ]);

  const lang = restaurant?.language ?? "EN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t(lang, "Take Order", "अर्डर लिनुहोस्")}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {t(
            lang,
            "Serve food for tables right from the counter",
            "काउन्टरबाटै टेबलमा खाना सेवा गर्नुहोस्"
          )}
        </p>
      </div>
      <ServiceTables
        tables={JSON.parse(JSON.stringify(tables))}
        language={lang}
      />
    </div>
  );
}