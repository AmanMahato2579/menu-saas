import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tables</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage tables and generate QR codes for each table
        </p>
      </div>
      <TablesClient
        tables={JSON.parse(JSON.stringify(tables))}
        restaurantSlug={restaurant?.slug ?? ""}
        restaurantId={user.restaurantId!}
      />
    </div>
  );
}
