import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { getEffectiveAccess } from "@/lib/plans";
import { notFound } from "next/navigation";
import RestaurantDetailClient from "./RestaurantDetailClient";

export const metadata = { title: "Restaurant – Super Admin" };
export const dynamic = "force-dynamic";

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  await requireSuperAdmin();
  const { restaurantId } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { tables: true, users: true, orders: true, bookings: true } },
    },
  });
  if (!restaurant) notFound();

  const activity = await prisma.adminActivity.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  const access = await getEffectiveAccess(restaurant);

  return (
    <RestaurantDetailClient
      restaurant={JSON.parse(JSON.stringify(restaurant))}
      activity={JSON.parse(JSON.stringify(activity))}
      features={access.features}
    />
  );
}
