import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import MenuPageClient from "./MenuPageClient";

export const metadata = { title: "Menu – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const user = await requireRestaurantAdmin();
  const restaurantId = user.restaurantId!;

  const categories = await prisma.category.findMany({
    where: { restaurantId },
    orderBy: { displayOrder: "asc" },
    include: {
      menuItems: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your categories and menu items
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/menu/categories">
            <Button variant="outline">Manage Categories</Button>
          </Link>
          <Link href="/admin/menu/items/new">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              + Add Item
            </Button>
          </Link>
        </div>
      </div>

      <MenuPageClient
        categories={JSON.parse(JSON.stringify(categories))}
        restaurantId={restaurantId}
      />
    </div>
  );
}
