"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import MenuItemModal from "@/components/customer/MenuItemModal";
import { ShoppingCart, ChevronRight, Star } from "lucide-react";
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
  tableSession: TableSession;
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
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(CART_KEY(tableSession.id));
    if (saved) {
      try { return JSON.parse(saved) as CartItem[]; } catch {}
    }
    return [];
  });
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id ?? "");
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // (cart is initialized from localStorage in the state initializer)

  // Save cart to localStorage
  const updateCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem(CART_KEY(tableSession.id), JSON.stringify(newCart));
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
      localStorage.setItem(CART_KEY(tableSession.id), JSON.stringify(newCart));
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

        {/* Menu Categories */}
        {categories.length === 0 ? (
          <div className="text-center py-20 px-4 text-gray-400">
            <p className="text-2xl mb-2">🍽️</p>
            <p className="font-medium">No menu items available yet</p>
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-8">
            {categories.map((category) => (
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
                          <p className="font-semibold text-gray-900">{item.name}</p>
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
