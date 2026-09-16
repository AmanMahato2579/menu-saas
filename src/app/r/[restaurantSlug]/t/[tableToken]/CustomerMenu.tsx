"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import MenuItemModal from "@/components/customer/MenuItemModal";
import { useCustomerLanguage, LanguageToggle } from "@/hooks/use-customer-lang";
import { ShoppingCart, BellRing, Loader2, AlertCircle, Receipt, ClipboardList, Phone, Copy, Check, CalendarCheck } from "lucide-react";
import type { CartItem } from "@/types";
import { loadCart, saveCart } from "@/lib/customer-storage";
import { validBrandColor } from "@/lib/brand";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  currency: string;
  openingHours: string | null;
  phone?: string | null;
  language?: string;
  bookingsEnabled?: boolean;
  brandColor?: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  ingredients: string | null;
  discountPercent: number;
  isAvailable: boolean;
  hasSpicyOption: boolean;
  hasNoteOption: boolean;
  categoryId: string;
  foodType: string | null;
  variants?: { id: string; name: string; price: string }[];
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  menuItems: MenuItem[];
}

interface Offer {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
}

interface TableSession {
  id: string;
}

interface Props {
  restaurant: Restaurant;
  table: { id: string; tableNumber: number };
  tableSession: TableSession | null;
  categories: Category[];
}

export default function CustomerMenu({ restaurant, table, tableSession, categories }: Props) {
  const params = useParams();
  const [lang, setLang] = useCustomerLanguage(restaurant.id, restaurant.language ?? "EN");
  const [customerName, setCustomerName] = useState("");
  const [starting, setStarting] = useState(false);
  const [calling, setCalling] = useState(false);
  const [foodFilter, setFoodFilter] = useState<"ALL" | "VEG" | "NON_VEG">("ALL");
  const [cart, setCart] = useState<CartItem[]>(() => (tableSession ? loadCart(tableSession.id) : []));
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id ?? "");
  const [sessionEnded, setSessionEnded] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Poll for session status — detect when owner ends session mid-browse
  const checkSession = useCallback(async () => {
    if (!tableSession) return;
    try {
      const res = await fetch(`/api/customer/sessions/${tableSession.id}/orders`, { cache: "no-store" });
      if (res.status === 404 || res.status === 410) {
        setSessionEnded(true);
      }
    } catch { /* network errors are non-fatal */ }
  }, [tableSession]);

  useEffect(() => {
    if (!tableSession) return;
    const id = setInterval(checkSession, 20_000); // every 20 seconds
    return () => clearInterval(id);
  }, [tableSession, checkSession]);

  // (cart is initialized from localStorage in the state initializer)

  // Save cart to localStorage
  const updateCart = (newCart: CartItem[]) => {
    setCart(newCart);
    if (tableSession) saveCart(tableSession.id, newCart);
  };

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const idx = prev.findIndex(
        (c) =>
          c.menuItemId === item.menuItemId &&
          c.variantId === item.variantId &&
          c.isSpicy === item.isSpicy &&
          c.note === item.note
      );
      let newCart: CartItem[];
      if (idx >= 0) {
        newCart = [...prev];
        newCart[idx] = { ...newCart[idx], quantity: newCart[idx].quantity + item.quantity };
      } else {
        newCart = [...prev, item];
      }
      if (tableSession) saveCart(tableSession.id, newCart);
      return newCart;
    });
    setSelectedItem(null);
  };

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const scrollToCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    categoryRefs.current[categoryId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Observe which category is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.id.replace("cat-", ""));
          }
        });
      },
      { threshold: 0.3 }
    );
    Object.entries(categoryRefs.current).forEach(([, ref]) => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, [categories]);

  const baseUrl = `/r/${params.restaurantSlug}/t/${params.tableToken}`;

  // Helper: safely resolve food type (null/undefined/unknown → NONE so no
  // misleading Veg/Non-Veg indicator is shown for drinks & other products)
  const resolveType = (item: MenuItem): "VEG" | "NON_VEG" | "NONE" =>
    item.foodType === "VEG" || item.foodType === "NON_VEG" ? item.foodType : "NONE";

  // Filtered categories based on food type selection
  const filteredCategories = categories.map((cat) => ({
    ...cat,
    menuItems: cat.menuItems.filter((item) => {
      if (foodFilter === "ALL") return true;
      if (foodFilter === "NON_VEG") return resolveType(item) === "NON_VEG";
      return resolveType(item) === "VEG";
    }),
  })).filter((cat) => cat.menuItems.length > 0);

  const startSession = async () => {
    setStarting(true);
    try {
      const res = await fetch(`/api/customer/tables/${params.tableToken}/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName }) });
      if (!res.ok) throw new Error();
      window.location.reload();
    } finally { setStarting(false); }
  };
  const callForHelp = async () => {
    if (!tableSession || calling) return;
    setCalling(true);
    try {
      const res = await fetch(`/api/customer/sessions/${tableSession.id}/assist`, { method: "POST" });
      if (res.ok) alert(t(lang, "Your server has been notified.", "तपाईंको सूचना कर्मचारीलाई पठाइयो।"));
    } finally { setCalling(false); }
  };

  const copyPhone = async () => {
    if (!restaurant.phone) return;
    try {
      await navigator.clipboard.writeText(restaurant.phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      alert(t(lang, "Could not copy the number.", "नम्बर कपी गर्न सकिएन।"));
    }
  };

  if (!tableSession) return (
    <div data-brand={validBrandColor(restaurant.brandColor)} className="min-h-screen bg-orange-50 flex items-center justify-center p-5">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-7 text-center">
        <div className="text-4xl mb-3">🍽️</div>
        <h1 className="text-2xl font-bold">{t(lang, `Welcome to ${restaurant.name}`, `${restaurant.name} मा स्वागत छ`)}</h1>
        <p className="text-gray-500 mt-2">
          {t(
            lang,
            `You are at Table ${table.tableNumber}. Start when you are ready and we’ll let the team know you’ve arrived.`,
            `तपाईं टेबल ${table.tableNumber} मा हुनुहुन्छ। तयार हुनुभयो भने सुरु गर्नुहोस्, हामी कर्मचारीलाई जानकारी दिनेछौं।`
          )}
        </p>
        <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={80} placeholder={t(lang, "Your name (optional)", "तपाईंको नाम (ऐच्छिक)")} className="mt-5 w-full rounded-xl border px-4 py-3" />
        <Button onClick={startSession} disabled={starting} className="w-full mt-3 h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold">{starting ? <Loader2 className="animate-spin" /> : t(lang, "Start session", "सेसन सुरु गर्नुहोस्")}</Button>
        {restaurant.bookingsEnabled && (
          <Link
            href={`${baseUrl}/book`}
            className="mt-4 inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-indigo-200 text-indigo-600 font-semibold text-sm hover:bg-indigo-50 transition-colors"
          >
            <CalendarCheck className="w-4 h-4" />
            {t(lang, "Book rooms & services (no session needed)", "कोठा र सेवाहरू बुक गर्नुहोस् (सेसन आवश्यक छैन)")}
          </Link>
        )}
      </div>
    </div>
  );

  if (sessionEnded) return (
    <div data-brand={validBrandColor(restaurant.brandColor)} className="min-h-screen bg-orange-50 flex items-center justify-center p-5">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-7 text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-orange-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">{t(lang, "Session Ended", "सेसन समाप्त")}</h1>
        <p className="text-gray-500 mt-2 text-sm">
          {t(
            lang,
            "The restaurant has closed this table session. Thank you for dining with us! If you wish to start a new session, please ask the staff.",
            "रेस्टुरेन्टले यो टेबल सेसन बन्द गरेको छ। हामीसँग खाना खानु भएकोमा धन्यवाद! नयाँ सेसन सुरु गर्न चाहनुहुन्छ भने कृपया कर्मचारीलाई भन्नुहोस्।"
          )}
        </p>
      </div>
    </div>
  );

  return (
    <div data-brand={validBrandColor(restaurant.brandColor)} className="min-h-screen bg-gray-50 pb-32">
      {/* Hero Header */}
      <div className="menu-hero-gradient text-white px-4 pt-8 pb-6 relative">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between gap-3">
            <LanguageToggle lang={lang} onChange={setLang} />
            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-sm font-medium">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              {t(lang, `Table ${table.tableNumber}`, `टेबल ${table.tableNumber}`)}
            </div>
          </div>
          {restaurant.logoUrl ? (
            <img
              src={restaurant.logoUrl}
              alt={restaurant.name}
              className="w-16 h-16 rounded-2xl object-cover mb-3 shadow-lg"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-3 text-3xl">
              🍽️
            </div>
          )}
          <h1 className="text-2xl font-bold">{restaurant.name}</h1>
          {restaurant.description && (
            <p className="text-white/80 text-sm mt-1">{restaurant.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto">

        {/* Quick links: My Orders + View Bill + Book (if enabled) */}
        <div className={`px-4 pt-4 grid gap-3 sticky top-[-4px] z-20 ${restaurant.bookingsEnabled ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
          <Link
            href={`${baseUrl}/orders`}
            className="flex items-center justify-center gap-2 p-3.5 bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow"
          >
            <ClipboardList className="w-4 h-4 text-orange-500" />
            <span className="font-semibold text-gray-800">{t(lang, "My Orders", "मेरा अर्डरहरू")}</span>
          </Link>
          <Link
            href={`${baseUrl}/bill`}
            className="flex items-center justify-center gap-2 p-3.5 bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow"
          >
            <Receipt className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-gray-800">{t(lang, "View Bill", "बिल हेर्नुहोस्")}</span>
          </Link>
          {restaurant.bookingsEnabled && (
            <Link
              href={`${baseUrl}/book`}
              className="flex items-center justify-center gap-2 p-3.5 bg-white rounded-2xl border border-indigo-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <CalendarCheck className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold text-gray-800">{t(lang, "Book", "बुकिङ")}</span>
            </Link>
          )}
        </div>

        {/* Category Nav */}
        {categories.length > 1 && (
          <div className="sticky top-0 z-30 bg-gray-50/95 backdrop-blur-sm px-4 pt-4 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeCategory === cat.id
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-white text-gray-600 border hover:border-orange-300"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Food Type Filter */}
        <div className="px-4 pt-3">
          <div className="flex gap-2">
            {(["ALL", "VEG", "NON_VEG"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFoodFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  foodFilter === f
                    ? f === "NON_VEG"
                      ? "bg-red-500 text-white border-red-500"
                      : f === "VEG"
                      ? "bg-green-500 text-white border-green-500"
                      : "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                }`}
              >
                {f === "ALL" ? t(lang, "All", "सबै") : f === "VEG" ? t(lang, "🟢 Veg", "🟢 शाकाहारी") : t(lang, "🔴 Non-Veg", "🔴 मासु")}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Categories */}
        {filteredCategories.length === 0 ? (
          <div className="text-center py-20 px-4 text-gray-400">
            <p className="text-2xl mb-2">🍽️</p>
            <p className="font-medium">
              {foodFilter === "ALL"
                ? t(lang, "No menu items available yet", "अहिलेसम्म कुनै मेनु आइटम छैन")
                : t(lang, `No ${foodFilter === "VEG" ? "veg" : "non-veg"} items available`, `कुनै ${foodFilter === "VEG" ? "शाकाहारी" : "मासु"} परिकार छैन`)}
            </p>
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-8">
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                id={`cat-${category.id}`}
                ref={(el) => { categoryRefs.current[category.id] = el; }}
              >
                <h2 className="text-xl font-bold text-gray-900 mb-3">{category.name}</h2>
                <div className="space-y-3">
                  {category.menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 flex overflow-hidden menu-card-hover"
                    >
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-24 h-24 object-cover shrink-0"
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {resolveType(item) === "NONE" ? (
                              <span className="w-3 h-3 rounded-sm border-2 border-gray-300 flex-shrink-0" title="Other" />
                            ) : (
                              <span className={`w-3 h-3 rounded-sm border-2 flex-shrink-0 ${resolveType(item) === "NON_VEG" ? "border-red-500" : "border-green-500"}`} title={resolveType(item) === "NON_VEG" ? "Non-Veg" : "Veg"} />
                            )}
                            <p className="font-semibold text-gray-900">{item.name}</p>
                          </div>
                          {item.description && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                          )}
                          {item.ingredients && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {item.ingredients.split(',').map((ing, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-sm uppercase tracking-wider font-medium">
                                  {ing.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex flex-col">
                            {item.discountPercent > 0 && (
                              <span className="text-xs text-gray-400 line-through">
                                {formatCurrency(item.price, restaurant.currency)}
                              </span>
                            )}
                            <p className="font-bold text-orange-600">
                              {formatCurrency(
                                item.discountPercent > 0
                                  ? parseFloat(item.price) - (parseFloat(item.price) * item.discountPercent / 100)
                                  : item.price,
                                restaurant.currency
                          )}
                            </p>
                          </div>
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg hover:bg-orange-600 transition-colors shadow-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Call for assistance — bottom */}
        <div className="px-4 mt-8 space-y-2">
          {restaurant.phone && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">{t(lang, "Call the restaurant", "रेस्टुरेन्टलाई कल गर्नुहोस्")}</p>
                <a href={`tel:${restaurant.phone.replace(/[^+\d]/g, "")}`} className="font-bold text-gray-900 block truncate">{restaurant.phone}</a>
              </div>
              <button
                onClick={copyPhone}
                className="h-9 px-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 text-xs font-medium shrink-0"
              >
                {copiedPhone ? (
                  <><Check className="w-3.5 h-3.5 text-green-600" /> {t(lang, "Copied", "कपी भयो")}</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> {t(lang, "Copy", "कपी गर्नुहोस्")}</>
                )}
              </button>
            </div>
          )}
          <button onClick={callForHelp} disabled={calling} className="w-full flex items-center justify-between p-4 bg-orange-50 text-orange-700 rounded-2xl border border-orange-200 font-medium">
            <span className="flex items-center gap-2"><BellRing className="w-5 h-5" /> {t(lang, "Call for assistance", "सहायता माग्नुहोस्")}</span><span className="text-xs">{calling ? t(lang, "Sending…", "पठाउँदै…") : t(lang, "Always available", "सधैं उपलब्ध")}</span>
          </button>
        </div>
      </div>

      {/* Sticky Cart Button */}
      {cartCount > 0 && (
        <div className="sticky-cart">
          <div className="max-w-lg mx-auto">
            <Link href={`${baseUrl}/cart`}>
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white h-14 rounded-2xl text-base font-bold shadow-xl shadow-orange-500/30 flex items-center justify-between px-6">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm">
                    {cartCount}
                  </span>
                </div>
                <span>{t(lang, "View Cart", "कार्ट हेर्नुहोस्")}</span>
                <span>{formatCurrency(cartTotal, restaurant.currency)}</span>
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {selectedItem && (
        <MenuItemModal
          item={selectedItem}
          currency={restaurant.currency}
          lang={lang}
          onClose={() => setSelectedItem(null)}
          onAddToCart={addToCart}
        />
      )}
    </div>
  );
}
