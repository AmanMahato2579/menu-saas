import { notFound, redirect } from "next/navigation";
import { getRestaurantBySlug, getTableByToken, getActiveSession, getSessionBill } from "@/lib/db";
import BillClient from "./BillClient";

interface Props {
  params: Promise<{ restaurantSlug: string; tableToken: string }>;
}

export const dynamic = "force-dynamic";

export default async function BillPage({ params }: Props) {
  const { restaurantSlug, tableToken } = await params;
  const restaurant = await getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();
  const table = await getTableByToken(tableToken);
  if (!table || table.restaurantId !== restaurant.id) notFound();
  const session = await getActiveSession(table.id, restaurant.id);
  if (!session) redirect(`/r/${restaurantSlug}/t/${tableToken}`);
  const { orders, subtotal, taxAmount, serviceChargeAmount, total } = await getSessionBill(session.id, restaurant.id);

  const baseUrl = `/r/${restaurantSlug}/t/${tableToken}`;

  return (
    <BillClient
      restaurant={{
        id: restaurant.id,
        name: restaurant.name,
        logoUrl: restaurant.logoUrl,
        currency: restaurant.currency,
        language: restaurant.language,
        taxRate: restaurant.taxRate ? Number(restaurant.taxRate) : 0,
        serviceChargeRate: restaurant.serviceChargeRate ? Number(restaurant.serviceChargeRate) : 0,
      }}
      table={{ tableNumber: table.tableNumber }}
      orders={JSON.parse(JSON.stringify(orders))}
      subtotal={Number(subtotal)}
      taxAmount={Number(taxAmount)}
      serviceChargeAmount={Number(serviceChargeAmount)}
      total={Number(total)}
      baseUrl={baseUrl}
    />
  );
}
