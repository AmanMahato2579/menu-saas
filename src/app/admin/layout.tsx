import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import AdminShell from "@/components/admin/AdminShell";
import AuthStateWatcher from "@/components/admin/AuthStateWatcher";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  let unreadCount = 0;
  let language = "EN";
  if (user.restaurantId) {
    const [notifCount, restaurant] = await Promise.all([
      prisma.notification.count({
        where: { restaurantId: user.restaurantId, read: false },
      }),
      prisma.restaurant.findUnique({
        where: { id: user.restaurantId },
        select: { language: true },
      }),
    ]);
    unreadCount = notifCount;
    language = restaurant?.language ?? "EN";
  }

  return (
    <>
      <AuthStateWatcher />
      <AdminShell user={user} initialUnreadCount={unreadCount} language={language}>
        {children}
      </AdminShell>
    </>
  );
}
