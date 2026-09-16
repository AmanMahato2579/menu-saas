"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useCustomerLanguage, LanguageToggle } from "@/hooks/use-customer-lang";
import { ArrowLeft, Trash2, Minus, Plus, Loader2, ShoppingCart } from "lucide-react";
import type { CartItem } from "@/types";
import { getOrCreateCustomerToken, loadCart, saveCart } from "@/lib/customer-storage";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  isTaxEnabled: boolean;
  taxRate: number;
  isServiceChargeEnabled: boolean;
  serviceChargeRate: number;
  language?: string;
}

interface Props {
  restaurant: Restaurant;
  table: { id: string; tableNumber: number };
  tableSession: { id: string; applyTax: boolean; applyServiceCharge: boolean };
}

export default function CartClient({ restaurant, table, tableSession }: Props) {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [lang, setLang] = useCustomerLanguage(restaurant.id, restaurant.language ?? "EN");
  const [cart, setCart] = useState<CartItem[]>(() => loadCart(tableSession.id));
  const [placing, setPlacing] = useState(false);

  const baseUrl = `/r/${params.restaurantSlug}/t/${params.tableToken}`;

  const updateQuantity = (idx: number, delta: number) => {
    const newCart = [...cart];
    newCart[idx] = { ...newCart[idx], quantity: Math.max(1, newCart[idx].quantity + delta) };
    setCart(newCart);
    saveCart(tableSession.id, newCart);
  };

  const removeItem = (idx: number) => {
    const newCart = cart.filter((_, i) => i !== idx);
    setCart(newCart);
    saveCart(tableSession.id, newCart);
  };

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const taxAmount = restaurant.isTaxEnabled && tableSession.applyTax
    ? subtotal * (restaurant.taxRate / 100) : 0;
  const serviceChargeAmount = restaurant.isServiceChargeEnabled && tableSession.applyServiceCharge
    ? subtotal * (restaurant.serviceChargeRate / 100) : 0;
  const total = subtotal + taxAmount + serviceChargeAmount;

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    const customerToken = getOrCreateCustomerToken();
    try {
      const res = await fetch("/api/customer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          tableSessionId: tableSession.id,
          customerToken,
          items: cart.map((i) => ({
            menuItemId: i.menuItemId,
            variantId: i.variantId,
            quantity: i.quantity,
            isSpicy: i.isSpicy,
            note: i.note,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: t(lang, "Order failed", "अर्डर असफल"), variant: "destructive", description: err.error });
        return;
      }

      const order = await res.json();
      // Clear cart
      saveCart(tableSession.id, []);
      setCart([]);
      toast({ title: t(lang, "Order placed! 🎉", "अर्डर सफल भयो! 🎉"), variant: "success", description: t(lang, `Order #${order.orderNumber} received.`, `अर्डर #${order.orderNumber} प्राप्त भयो।`) });
      // Keep the guest in the active session so they can add more items later.
      router.push(baseUrl);
    } catch {
      toast({ title: t(lang, "Network error", "नेटवर्क त्रुटि"), variant: "destructive", description: t(lang, "Please try again.", "कृपया फेरि प्रयास गर्नुहोस्।") });
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={baseUrl}>
            <button className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <h1 className="font-bold text-gray-900 text-lg">{t(lang, "Your Cart", "तपाईंको कार्ट")}</h1>
          <div className="ml-auto flex items-center gap-3">
            <LanguageToggle lang={lang} onChange={setLang} variant="light" />
            <span className="text-sm text-gray-400">{t(lang, `Table ${table.tableNumber}`, `टेबल ${table.tableNumber}`)}</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4">
        {cart.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-500">{t(lang, "Your cart is empty", "तपाईंको कार्ट खाली छ")}</p>
            <p className="text-sm text-gray-400 mt-1">{t(lang, "Add some delicious items from the menu", "मेनुबाट केही स्वादिलो परिकार थप्नुहोस्")}</p>
            <Link href={baseUrl}>
              <Button className="mt-6 bg-orange-500 hover:bg-orange-600 text-white">
                {t(lang, "Browse Menu", "मेनु हेर्नुहोस्")}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Items */}
            {cart.map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{item.menuItemName}</p>
                    {item.variantName && <p className="text-xs text-gray-500">{item.variantName}</p>}
                    {item.isSpicy && <p className="text-xs text-red-500 mt-0.5">🌶️ {t(lang, "Spicy", "पिरो")}</p>}
                    {item.note && <p className="text-xs text-gray-400 italic mt-0.5">&quot;{item.note}&quot;</p>}
                  </div>
                  <button
                    onClick={() => removeItem(idx)}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-orange-400"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold text-lg w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="font-bold text-orange-600">
                    {formatCurrency(item.price * item.quantity, restaurant.currency)}
                  </p>
                </div>
              </div>
            ))}

            {/* Summary */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mt-2">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>{t(lang, "Subtotal", "जम्मा")} ({cart.reduce((s, i) => s + i.quantity, 0)} {t(lang, "items", "वस्तुहरू")})</span>
                <span>{formatCurrency(subtotal, restaurant.currency)}</span>
              </div>
              {restaurant.isTaxEnabled && tableSession.applyTax && (
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>{t(lang, "VAT / Tax", "भ्याट / कर")} ({restaurant.taxRate}%)</span>
                  <span>{formatCurrency(taxAmount, restaurant.currency)}</span>
                </div>
              )}
              {restaurant.isServiceChargeEnabled && tableSession.applyServiceCharge && (
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>{t(lang, "Service Charge", "सेवा शुल्क")} ({restaurant.serviceChargeRate}%)</span>
                  <span>{formatCurrency(serviceChargeAmount, restaurant.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-lg pt-2 border-t mt-2">
                <span>{t(lang, "Total", "कुल")}</span>
                <span className="text-orange-600">{formatCurrency(total, restaurant.currency)}</span>
              </div>
            </div>

            {/* Table info */}
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center">
              <p className="text-sm text-orange-700">
                {t(lang, "Ordering for", "अर्डर गर्दै")} <strong>{t(lang, `Table ${table.tableNumber}`, `टेबल ${table.tableNumber}`)}</strong> at {restaurant.name}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Place Order Button */}
      {cart.length > 0 && (
        <div className="sticky-cart">
          <div className="max-w-lg mx-auto">
            <Button
              onClick={placeOrder}
              disabled={placing}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-14 rounded-2xl text-base font-bold shadow-xl shadow-orange-500/30"
            >
              {placing ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {t(lang, "Placing Order...", "अर्डर राख्दै...")}</>
              ) : (
                `${t(lang, "Place Order", "अर्डर गर्नुहोस्")} · ${formatCurrency(total, restaurant.currency)}`
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
