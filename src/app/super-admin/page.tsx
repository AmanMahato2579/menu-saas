import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import SuperAdminClient from "./SuperAdminClient";
import AuthStateWatcher from "@/components/admin/AuthStateWatcher";

export const metadata = { title: "Super Admin – MenuQR" };
export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  await requireSuperAdmin();
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { tables: true, users: true } },
    },
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AuthStateWatcher />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Super Admin</h1>
            <p className="text-gray-400 mt-1">Manage all restaurants on MenuQR</p>
          </div>
        </div>
        <SuperAdminClient restaurants={JSON.parse(JSON.stringify(restaurants))} />
      </div>
    </div>
  );
}
