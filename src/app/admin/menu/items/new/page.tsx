import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import MenuItemForm from "@/components/admin/MenuItemForm";

interface Props {
  searchParams: Promise<{ categoryId?: string }>;
}

export const metadata = { title: "Add Menu Item – MenuQR Admin" };

export default async function NewMenuItemPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await requireRestaurantAdmin();
  const categories = await prisma.category.findMany({
    where: { restaurantId: user.restaurantId!, isActive: true },
    orderBy: { displayOrder: "asc" },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add Menu Item</h1>
        <p className="text-gray-500 text-sm mt-1">Create a new item for your menu</p>
      </div>
      <MenuItemForm
        categories={JSON.parse(JSON.stringify(categories))}
        defaultCategoryId={params.categoryId}
      />
    </div>
  );
}
