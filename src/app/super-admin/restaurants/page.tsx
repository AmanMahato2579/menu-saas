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
      users: { select: { name: true, email: true, role: true }, orderBy: { createdAt: "asc" } },
      _count: { select: { tables: true, users: true, orders: true, bookings: true } },
    },
  });

  const rows = restaurants.map((r) => {
    const owner = r.users.find((u) => u.role === "RESTAURANT_ADMIN") ?? r.users[0] ?? null;
    return {
      ...r,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Restaurants</h1>
        <p className="text-gray-400 text-sm mt-1">
          Onboard restaurants, manage subscriptions and packages, review usage and star assignments.
        </p>
      </div>
      <SuperAdminClient restaurants={JSON.parse(JSON.stringify(rows))} />
    </div>
  );
}