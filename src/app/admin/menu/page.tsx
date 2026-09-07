import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import MenuPageClient from "./MenuPageClient";

export const metadata = { title: "Menu – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const user = await requireRestaurantAdmin();
  const restaurantId = user.restaurantId!;

  const [categories, restaurant] = await Promise.all([
    prisma.category.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        menuItems: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { variants: { orderBy: { createdAt: "asc" } } },
        },
      },
    }),
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { language: true } }),
  ]);
  const lang = restaurant?.language ?? "EN";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t(lang, "Menu", "मेनु")}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {t(lang, "Manage your categories and menu items", "आफ्ना कोटीहरू र मेनु वस्तुहरू व्यवस्थापन गर्नुहोस्")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/menu/categories">
            <Button variant="outline">{t(lang, "Manage Categories", "कोटीहरू व्यवस्थापन गर्नुहोस्")}</Button>
          </Link>
          <Link href="/admin/menu/items/new">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              + {t(lang, "Add Item", "वस्तु थप्नुहोस्")}
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
