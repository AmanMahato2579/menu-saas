import { notFound } from "next/navigation";
import { getRestaurantBySlug, getTableByToken, getOrCreateActiveSession } from "@/lib/db";
import CartClient from "./CartClient";

interface Props {
  params: Promise<{ restaurantSlug: string; tableToken: string }>;
}

export const dynamic = "force-dynamic";

export default async function CartPage({ params }: Props) {
  const { restaurantSlug, tableToken } = await params;
  const restaurant = await getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();
  const table = await getTableByToken(tableToken);
  if (!table || table.restaurantId !== restaurant.id || !table.isActive) notFound();
  const session = await getOrCreateActiveSession(table.id, restaurant.id);

  return (
    <CartClient
      restaurant={JSON.parse(JSON.stringify(restaurant))}
      table={JSON.parse(JSON.stringify(table))}
      tableSession={JSON.parse(JSON.stringify(session))}
    />
  );
}
