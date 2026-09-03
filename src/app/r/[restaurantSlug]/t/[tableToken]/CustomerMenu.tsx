"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import MenuItemModal from "@/components/customer/MenuItemModal";
import { ShoppingCart, ChevronRight, BellRing, Loader2, AlertCircle } from "lucide-react";
import type { CartItem } from "@/types";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  currency: string;
  openingHours: string | null;
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

const CART_KEY = (sessionId: string) => `cart_${sessionId}`;
const CUSTOMER_TOKEN_KEY = "menuqr_customer_token";

function getOrCreateCustomerToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  if (!token) {
    token = `ct_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  }
  return token;
}

export default function CustomerMenu({ restaurant, table, tableSession, categories }: Props) {
  const params = useParams();
  const [customerName, setCustomerName] = useState("");
  const [starting, setStarting] = useState(false);
  const [calling, setCalling] = useState(false);
  const [foodFilter, setFoodFilter] = useState<"ALL" | "VEG" | "NON_VEG">("ALL");
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = tableSession && localStorage.getItem(CART_KEY(tableSession.id));
    if (saved) {
      try { return JSON.parse(saved) as CartItem[]; } catch {}
    }
    return [];
  });
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id ?? "");
  const [sessionEnded, setSessionEnded] = useState(false);
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
    if (tableSession) localStorage.setItem(CART_KEY(tableSession.id), JSON.stringify(newCart));
  };

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const idx = prev.findIndex(
        (c) => c.menuItemId === item.menuItemId && c.isSpicy === item.isSpicy && c.note === item.note
      );
      let newCart: CartItem[];
      if (idx >= 0) {
        newCart = [...prev];
        newCart[idx] = { ...newCart[idx], quantity: newCart[idx].quantity + item.quantity };
      } else {
        newCart = [...prev, item];
      }
      if (tableSession) localStorage.setItem(CART_KEY(tableSession.id), JSON.stringify(newCart));
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

  // Helper: safely resolve food type (null/undefined → VEG)
  const resolveType = (item: MenuItem) => (item.foodType === "NON_VEG" ? "NON_VEG" : "VEG");

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
    try { const res = await fetch(`/api/customer/sessions/${tableSession.id}/assist`, { method: "POST" }); if (res.ok) alert("Your server has been notified."); } finally { setCalling(false); }
  };

  if (!tableSession) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-5">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-7 text-center">
        <div className="text-4xl mb-3">🍽️</div><h1 className="text-2xl font-bold">Welcome to {restaurant.name}</h1>
        <p className="text-gray-500 mt-2">You are at Table {table.tableNumber}. Start when you are ready and we’ll let the team know you’ve arrived.</p>
        <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={80} placeholder="Your name (optional)" className="mt-5 w-full rounded-xl border px-4 py-3" />
        <Button onClick={startSession} disabled={starting} className="w-full mt-3 h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold">{starting ? <Loader2 className="animate-spin" /> : "Start session"}</Button>
      </div>
    </div>
  );

  if (sessionEnded) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-5">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-7 text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-orange-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Session Ended</h1>
        <p className="text-gray-500 mt-2 text-sm">
          The restaurant has closed this table session. Thank you for dining with us!
          If you wish to start a new session, please ask the staff.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Hero Header */}
      <div className="menu-hero-gradient text-white px-4 pt-8 pb-6">
        <div className="max-w-lg mx-auto">
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
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 mt-3 text-sm font-medium">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Table {table.tableNumber}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto">

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
                {f === "ALL" ? "All" : f === "VEG" ? "🟢 Veg" : "🔴 Non-Veg"}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Categories */}
        {filteredCategories.length === 0 ? (
          <div className="text-center py-20 px-4 text-gray-400">
            <p className="text-2xl mb-2">🍽️</p>
            <p className="font-medium">
              {foodFilter === "ALL" ? "No menu items available yet" : `No ${foodFilter === "VEG" ? "veg" : "non-veg"} items available`}
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
                            <span className={`w-3 h-3 rounded-sm border-2 flex-shrink-0 ${resolveType(item) === "NON_VEG" ? "border-red-500" : "border-green-500"}`} title={resolveType(item) === "NON_VEG" ? "Non-Veg" : "Veg"} />
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

        {/* Nav links */}
        <div className="px-4 mt-8 space-y-2">
          <button onClick={callForHelp} disabled={calling} className="w-full flex items-center justify-between p-4 bg-orange-50 text-orange-700 rounded-2xl border border-orange-200 font-medium">
            <span className="flex items-center gap-2"><BellRing className="w-5 h-5" /> Call for assistance</span><span className="text-xs">{calling ? "Sending…" : "Always available"}</span>
          </button>
          <Link
            href={`${baseUrl}/orders`}
            className="flex items-center justify-between p-4 bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow"
          >
            <span className="font-medium text-gray-700">My Orders</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
          <Link
            href={`${baseUrl}/bill`}
            className="flex items-center justify-between p-4 bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow"
          >
            <span className="font-medium text-gray-700">View Bill</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
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
                <span>View Cart</span>
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
          onClose={() => setSelectedItem(null)}
          onAddToCart={addToCart}
        />
      )}
    </div>
  );
}
