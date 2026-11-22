import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const base = new URL(siteUrl).origin;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, priority: 1 },
  ];

  let restaurantRoutes: MetadataRoute.Sitemap = [];
  try {
    // Only public, active restaurants are indexed.
    const restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      take: 1000,
    });
    restaurantRoutes = restaurants.map((r) => ({
      url: `${base}/r/${r.slug}`,
      lastModified: r.updatedAt,
      priority: 0.6,
    }));
  } catch {
    // Never fail the whole sitemap because of a database hiccup.
  }

  return [...staticRoutes, ...restaurantRoutes];
}