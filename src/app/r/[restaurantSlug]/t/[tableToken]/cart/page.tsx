import { notFound, redirect } from "next/navigation";
import { getRestaurantBySlug, getTableByToken, getActiveSession } from "@/lib/db";
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
  const session = await getActiveSession(table.id, restaurant.id);
  if (!session) redirect(`/r/${restaurantSlug}/t/${tableToken}`);

  return (
    <CartClient
      restaurant={{
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        currency: restaurant.currency,
        isTaxEnabled: restaurant.isTaxEnabled,
        taxRate: Number(restaurant.taxRate),
        isServiceChargeEnabled: restaurant.isServiceChargeEnabled,
        serviceChargeRate: Number(restaurant.serviceChargeRate),
      }}
      table={{ id: table.id, tableNumber: table.tableNumber }}
      tableSession={{
        id: session.id,
        applyTax: session.applyTax,
        applyServiceCharge: session.applyServiceCharge,
      }}
    />
  );
}
