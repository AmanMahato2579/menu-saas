import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import SuperAdminClient from "../SuperAdminClient";

export const metadata = { title: "Restaurants – Super Admin" };
export const dynamic = "force-dynamic";

export default async function RestaurantsPage() {
  await requireSuperAdmin();
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { tables: true, users: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Restaurants</h1>
        <p className="text-gray-400 text-sm mt-1">Onboard restaurants, manage subscriptions, plans and star assignments.</p>
      </div>
      <SuperAdminClient restaurants={JSON.parse(JSON.stringify(restaurants))} />
    </div>
  );
}