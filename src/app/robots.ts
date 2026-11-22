import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  const base = new URL(siteUrl);
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/super-admin", "/login", "/api/"],
    },
    sitemap: `${base.origin}/sitemap.xml`,
  };
}