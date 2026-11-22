import { notFound } from "next/navigation";
import Link from "next/link";
import { getRestaurantBySlug, getPublicMenu } from "@/lib/db";
import type { Metadata } from "next";
import { formatCurrency } from "@/lib/utils";
import { loadOperationalRestaurant, getEffectiveAccess, canOrder } from "@/lib/plans";
import { t } from "@/lib/i18n";
import { QrCode, Utensils, Languages } from "lucide-react";

interface Props {
  params: Promise<{ restaurantSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { restaurantSlug } = await params;
  const restaurant = await getRestaurantBySlug(restaurantSlug);
  return {
    title: restaurant ? `${restaurant.name} | Menu` : "Menu Not Found",
    description: restaurant?.description ?? undefined,
  };
}

export const dynamic = "force-dynamic";

function foodTypeBadge(type: string | null | undefined) {
  if (type === "VEG") {
    return <span className="w-3 h-3 rounded-sm border-2 border-green-600 flex-shrink-0" title="Veg" />;
  }
  if (type === "NON_VEG") {
    return <span className="w-3 h-3 rounded-sm border-2 border-red-600 flex-shrink-0" title="Non-Veg" />;
  }
  return <span className="w-3 h-3 rounded-sm border-2 border-gray-300 flex-shrink-0" title="Other" />;
}

export default async function SlugMenuPage({ params, searchParams }: Props) {
  const { restaurantSlug } = await params;
  const { lang: langParam } = await searchParams;
  const lang = langParam === "NEP" ? "NEP" : "EN";
  const toggleHref = lang === "NEP" ? `/r/${restaurantSlug}` : `/r/${restaurantSlug}?lang=NEP`;

  const restaurant = await getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();

  if (!restaurant.isActive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-orange-50">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t(lang, "Menu Unavailable", "मेनु उपलब्ध छैन")}</h1>
        <p className="text-gray-600 text-center max-w-sm">
          {t(lang, "This restaurant's menu is currently unavailable. Please contact the administrator to open it.", "यो रेस्टुरेन्टको मेनु अहिले उपलब्ध छैन। खोल्नका लागि व्यवस्थापकलाई सम्पर्क गर्नुहोस्।")}
        </p>
      </div>
    );
  }

  // Subscription gating: BRONZE = view-only menu; ordering needs the `ordering` feature.
  const op = await loadOperationalRestaurant(restaurant.id);
  const access = op ? await getEffectiveAccess(op) : null;
  const orderingEnabled = access ? canOrder(access) : false;

  const categories = await getPublicMenu(restaurant.id);
  const totalItems = categories.reduce((n, c) => n + c.menuItems.length, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Hero */}
      <div className="text-white px-4 pt-10 pb-8 relative menu-hero-gradient">
        <div className="max-w-2xl mx-auto text-center">
          {restaurant.logoUrl ? (
            <img
              src={restaurant.logoUrl}
              alt={restaurant.name}
              className="w-16 h-16 rounded-2xl object-cover mb-3 shadow-lg mx-auto"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-3 text-3xl mx-auto">
              🍽️
            </div>
          )}
          <h1 className="text-2xl font-bold">{restaurant.name} · Menu</h1>
          {restaurant.description && (
            <p className="text-white/80 text-sm mt-1">{restaurant.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* Language toggle */}
        <div className="mt-6 flex justify-end">
          <Link
            href={toggleHref}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 bg-white hover:border-orange-300"
          >
            <Languages className="w-3.5 h-3.5" />
            {lang === "EN" ? "नेपाली" : "English"}
          </Link>
        </div>

        {/* Ordering notice */}
        {orderingEnabled ? (
          <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-5 flex items-start gap-3">
            <QrCode className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-800">{t(lang, "Ordering is available at the table", "टेबलमा अर्डर उपलब्ध छ")}</p>
              <p className="text-sm text-orange-700 mt-1">
                {t(lang, "Scan the QR code printed on your table to start ordering online.", "टेबलमा छापिएको QR कोड स्क्यान गरेर अनलाइन अर्डर सुरु गर्नुहोस्।")}
                {restaurant.openingHours && (
                  <span className="block mt-1">{t(lang, "Open hours:", "खुल्ने समय:")} {restaurant.openingHours}</span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 flex items-start gap-3">
            <Utensils className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800">{t(lang, "Browse the menu", "मेनु हेर्नुहोस्")}</p>
              <p className="text-sm text-gray-500 mt-1">
                {t(lang, "For ordering, please contact the restaurant. Online ordering is not enabled for this menu.", "अर्डरका लागि कृपया रेस्टुरेन्टमा सम्पर्क गर्नुहोस्। यो मेनुको लागि अनलाइन अर्डर सक्षम छैन।")}
              </p>
            </div>
          </div>
        )}

        {/* Menu */}
        {totalItems === 0 ? (
          <div className="text-center py-20 px-4 text-gray-400">
            <p className="text-2xl mb-2">🍽️</p>
            <p className="font-medium">{t(lang, "No menu items available yet", "अहिलेसम्म मेनु आइटम उपलब्ध छैनन्")}</p>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {categories.map((category) => (
              <section key={category.id}>
                <h2 className="text-xl font-bold text-gray-900 mb-3">{category.name}</h2>
                {category.description && <p className="text-sm text-gray-400 mb-3">{category.description}</p>}
                <div className="space-y-3">
                  {category.menuItems.map((item) => {
                    const basePrice = item.price.toNumber();
                    const finalPrice =
                      item.discountPercent > 0 ? basePrice - (basePrice * item.discountPercent) / 100 : basePrice;
                    const priced = item.variants.map((v) => v.price.toNumber());
                    const bestVariant = priced.length ? Math.max(...priced) : null;
                    const lowVariant = priced.length ? Math.min(...priced) : null;
                    return (
                      <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 flex overflow-hidden">
                        {(item as { imageUrl?: string | null }).imageUrl && (
                          <img
                            src={(item as { imageUrl: string }).imageUrl}
                            alt={item.name}
                            className="w-24 h-24 object-cover shrink-0"
                            loading="lazy"
                          />
                        )}
                        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {foodTypeBadge(item.foodType)}
                              <p className="font-semibold text-gray-900">{item.name}</p>
                            </div>
                            {item.description && (
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex flex-col">
                              {item.discountPercent > 0 && (
                                <span className="text-xs text-gray-400 line-through">
                                  {formatCurrency(basePrice, restaurant.currency)}
                                </span>
                              )}
                              <p className="font-bold text-orange-600">
                                {bestVariant != null && lowVariant != null
                                  ? `${formatCurrency(lowVariant, restaurant.currency)} – ${formatCurrency(bestVariant, restaurant.currency)}`
                                  : formatCurrency(finalPrice, restaurant.currency)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-12 text-center text-sm text-gray-400">
          <Link href="/" className="hover:underline">MenuQR</Link>
        </footer>
      </div>
    </div>
  );
}
