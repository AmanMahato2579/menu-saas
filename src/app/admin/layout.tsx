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
  if (user.restaurantId) {
    unreadCount = await prisma.notification.count({
      where: { restaurantId: user.restaurantId, read: false },
    });
  }

  return (
    <>
      <AuthStateWatcher />
      <AdminShell user={user} initialUnreadCount={unreadCount}>
        {children}
      </AdminShell>
    </>
  );
}
