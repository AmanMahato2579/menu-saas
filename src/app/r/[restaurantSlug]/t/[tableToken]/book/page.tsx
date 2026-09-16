import { notFound } from "next/navigation";
import { getRestaurantBySlug, getTableByToken, getActiveSession, getBookableServices } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import BookClient from "./BookClient";
import { validBrandColor } from "@/lib/brand";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ restaurantSlug: string; tableToken: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { restaurantSlug } = await params;
  const restaurant = await getRestaurantBySlug(restaurantSlug);
  return { title: `${restaurant?.name ?? "Menu"} | Book` };
}

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: Props) {
  const { restaurantSlug, tableToken } = await params;

  const restaurant = await getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();

  const table = await getTableByToken(tableToken);
  if (!table || table.restaurantId !== restaurant.id || !table.isActive) notFound();

  const session = await getActiveSession(table.id, restaurant.id);
  const [services, restaurantData] = await Promise.all([
    restaurant.bookingsEnabled ? getBookableServices(restaurant.id) : Promise.resolve([]),
    prisma.restaurant.findUnique({
      where: { id: restaurant.id },
      select: { bookingsEnabled: true, language: true },
    }),
  ]);

  const enabled = restaurantData?.bookingsEnabled ?? restaurant.bookingsEnabled;

  return (
    <div data-brand={validBrandColor(restaurant.brandColor)}>
      <BookClient
        restaurant={JSON.parse(JSON.stringify({ id: restaurant.id, name: restaurant.name, slug: restaurant.slug, currency: restaurant.currency, language: restaurant.language, brandColor: restaurant.brandColor }))}
        tableToken={tableToken}
        sessionId={session?.id ?? null}
        services={JSON.parse(JSON.stringify(services))}
        enabled={enabled}
      />
    </div>
  );
}