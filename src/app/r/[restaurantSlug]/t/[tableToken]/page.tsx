import { notFound } from "next/navigation";
import { getRestaurantBySlug, getTableByToken, getActiveSession, getPublicMenu } from "@/lib/db";
import CustomerMenu from "./CustomerMenu";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ restaurantSlug: string; tableToken: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { restaurantSlug } = await params;
  const restaurant = await getRestaurantBySlug(restaurantSlug);
  return {
    title: restaurant ? `${restaurant.name} | Digital Menu` : "Menu Not Found",
    description: restaurant?.description ?? undefined,
  };
}

export const dynamic = "force-dynamic";

export default async function MenuPage({ params }: Props) {
  const { restaurantSlug, tableToken } = await params;

  // 1. Find restaurant
  const restaurant = await getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();

  if (!restaurant.isActive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-orange-50">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Inactive</h1>
        <p className="text-gray-600 text-center max-w-sm">
          This restaurant&apos;s menu is currently unavailable. Please contact the administrator to open it.
        </p>
      </div>
    );
  }

  // 2. Find table
  const table = await getTableByToken(tableToken);
  if (!table || table.restaurantId !== restaurant.id || !table.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-orange-50">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">📵</div>
          <h1 className="text-xl font-bold text-gray-900">Table Not Found</h1>
          <p className="text-gray-500 mt-2">
            This table link is no longer active. Please scan the QR code on your table again.
          </p>
        </div>
      </div>
    );
  }

  // A scan is harmless; service starts only when the guest explicitly starts a session.
  const session = await getActiveSession(table.id, restaurant.id);

  // 4. Fetch menu
  const categories = await getPublicMenu(restaurant.id);

  return (
    <CustomerMenu
      restaurant={JSON.parse(JSON.stringify(restaurant))}
      table={JSON.parse(JSON.stringify(table))}
      tableSession={session ? JSON.parse(JSON.stringify(session)) : null}
      categories={JSON.parse(JSON.stringify(categories))}
    />
  );
}
