import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n";
import { startOfBusinessDay } from "@/lib/db";
import NotificationsClient from "./NotificationsClient";

export const metadata = { title: "Notifications – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireRestaurantAdmin();

  const [notifications, unreadCount, restaurant] = await Promise.all([
    prisma.notification.findMany({
      // Notifications reset at the start of the business day (00:00 local).
      where: { restaurantId: user.restaurantId!, createdAt: { gte: startOfBusinessDay() } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({
      where: { restaurantId: user.restaurantId!, createdAt: { gte: startOfBusinessDay() }, read: false },
    }),
    prisma.restaurant.findUnique({
      where: { id: user.restaurantId! },
      select: { language: true },
    }),
  ]);
  const lang = restaurant?.language ?? "EN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t(lang, "Notifications", "सूचनाहरू")}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {unreadCount > 0
            ? `${unreadCount} ${t(lang, "unread notification", "नपढिएका सूचनाहरू")}${unreadCount > 1 ? (lang === "NEP" ? "" : "s") : ""}`
            : t(lang, "You're all caught up", "सबै सूचना पढिसक्नुभयो")}
        </p>
      </div>
      <NotificationsClient
        notifications={JSON.parse(JSON.stringify(notifications))}
        unreadCount={unreadCount}
        language={lang}
      />
    </div>
  );
}
