import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import NotificationsClient from "./NotificationsClient";

export const metadata = { title: "Notifications – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireRestaurantAdmin();

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { restaurantId: user.restaurantId! },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({
      where: { restaurantId: user.restaurantId!, read: false },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-500 text-sm mt-1">
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "You're all caught up"}
        </p>
      </div>
      <NotificationsClient
        notifications={JSON.parse(JSON.stringify(notifications))}
        unreadCount={unreadCount}
      />
    </div>
  );
}
