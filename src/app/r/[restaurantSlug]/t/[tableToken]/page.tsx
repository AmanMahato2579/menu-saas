import { notFound } from "next/navigation";
import { getRestaurantBySlug, getTableByToken, getOrCreateActiveSession, getPublicMenu, getActiveOffers } from "@/lib/db";
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

  // 3. Get or create active session
  const session = await getOrCreateActiveSession(table.id, restaurant.id);

  // 4. Fetch menu + offers
  const [categories, offers] = await Promise.all([
    getPublicMenu(restaurant.id),
    getActiveOffers(restaurant.id),
  ]);

  return (
    <CustomerMenu
      restaurant={JSON.parse(JSON.stringify(restaurant))}
      table={JSON.parse(JSON.stringify(table))}
      tableSession={JSON.parse(JSON.stringify(session))}
      categories={JSON.parse(JSON.stringify(categories))}
      offers={JSON.parse(JSON.stringify(offers))}
    />
  );
}
