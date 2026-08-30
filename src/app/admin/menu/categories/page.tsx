import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import CategoriesClient from "./CategoriesClient";

export const metadata = { title: "Categories – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const user = await requireRestaurantAdmin();
  const categories = await prisma.category.findMany({
    where: { restaurantId: user.restaurantId! },
    orderBy: { displayOrder: "asc" },
    include: { _count: { select: { menuItems: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <p className="text-gray-500 text-sm mt-1">Organize your menu into sections</p>
      </div>
      <CategoriesClient
        categories={JSON.parse(JSON.stringify(categories))}
        restaurantId={user.restaurantId!}
      />
    </div>
  );
}
