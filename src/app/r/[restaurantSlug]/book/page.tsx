import { notFound } from "next/navigation";
import { getRestaurantBySlug, getBookableServices } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import BookClient from "../t/[tableToken]/book/BookClient";
import { validBrandColor } from "@/lib/brand";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ restaurantSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { restaurantSlug } = await params;
  const restaurant = await getRestaurantBySlug(restaurantSlug);
  return { title: `${restaurant?.name ?? "Restaurant"} | Book` };
}

export const dynamic = "force-dynamic";

export default async function PublicBookPage({ params }: Props) {
  const { restaurantSlug } = await params;

  const restaurant = await getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();

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
        services={JSON.parse(JSON.stringify(services))}
        enabled={enabled}
        publicMode
      />
    </div>
  );
}
