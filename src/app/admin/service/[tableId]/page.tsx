import { notFound } from "next/navigation";
import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { getActiveSession, getSessionOverview, getPublicMenu } from "@/lib/db";
import TableWorkspace from "./TableWorkspace";

export const metadata = { title: "Table Service – MenuQR Admin" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ tableId: string }>;
}

export default async function ServiceTablePage({ params }: Props) {
  const { tableId } = await params;
  const user = await requireRestaurantAdmin();

  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId: user.restaurantId! },
  });
  if (!table || !table.isActive) notFound();

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: user.restaurantId! },
  });

  const session = await getActiveSession(table.id, user.restaurantId!);
  const overview = session ? await getSessionOverview(session.id, user.restaurantId!) : null;
  const menu = await getPublicMenu(user.restaurantId!);

  return (
    <TableWorkspace
      table={JSON.parse(JSON.stringify(table))}
      initialSession={overview ? JSON.parse(JSON.stringify(overview)) : null}
      initialOrders={overview ? JSON.parse(JSON.stringify(overview.orders)) : []}
      menu={JSON.parse(JSON.stringify(menu))}
      currency={restaurant?.currency ?? "NPR"}
      lang={restaurant?.language ?? "EN"}
      isTaxEnabled={restaurant?.isTaxEnabled ?? false}
      taxRate={Number(restaurant?.taxRate ?? 0)}
      isServiceChargeEnabled={restaurant?.isServiceChargeEnabled ?? false}
      serviceChargeRate={Number(restaurant?.serviceChargeRate ?? 0)}
    />
  );
}