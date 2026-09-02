"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft, Trash2, Minus, Plus, Loader2, ShoppingCart } from "lucide-react";
import type { CartItem } from "@/types";

const CART_KEY = (sessionId: string) => `cart_${sessionId}`;
const CUSTOMER_TOKEN_KEY = "menuqr_customer_token";

function getCustomerToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  if (!token) {
    token = `ct_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  }
  return token;
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  isTaxEnabled: boolean;
  taxRate: number;
  isServiceChargeEnabled: boolean;
  serviceChargeRate: number;
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
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(CART_KEY(tableSession.id));
    if (saved) {
      try { return JSON.parse(saved) as CartItem[]; } catch {}
    }
    return [];
  });
  const [placing, setPlacing] = useState(false);

  const baseUrl = `/r/${params.restaurantSlug}/t/${params.tableToken}`;

  const updateQuantity = (idx: number, delta: number) => {
    const newCart = [...cart];
    newCart[idx] = { ...newCart[idx], quantity: Math.max(1, newCart[idx].quantity + delta) };
    setCart(newCart);
    localStorage.setItem(CART_KEY(tableSession.id), JSON.stringify(newCart));
  };

  const removeItem = (idx: number) => {
    const newCart = cart.filter((_, i) => i !== idx);
    setCart(newCart);
    localStorage.setItem(CART_KEY(tableSession.id), JSON.stringify(newCart));
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
    const customerToken = getCustomerToken();
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
        toast({ title: "Order failed", variant: "destructive", description: err.error });
        return;
      }

      const order = await res.json();
      // Clear cart
      localStorage.setItem(CART_KEY(tableSession.id), "[]");
      setCart([]);
      toast({ title: "Order placed! 🎉", variant: "success", description: `Order #${order.orderNumber} received.` });
      // Keep the guest in the active session so they can add more items later.
      router.push(baseUrl);
    } catch {
      toast({ title: "Network error", variant: "destructive", description: "Please try again." });
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
          <h1 className="font-bold text-gray-900 text-lg">Your Cart</h1>
          <span className="text-sm text-gray-400 ml-auto">Table {table.tableNumber}</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4">
        {cart.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-500">Your cart is empty</p>
            <p className="text-sm text-gray-400 mt-1">Add some delicious items from the menu</p>
            <Link href={baseUrl}>
              <Button className="mt-6 bg-orange-500 hover:bg-orange-600 text-white">
                Browse Menu
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
                    {item.isSpicy && <p className="text-xs text-red-500 mt-0.5">🌶️ Spicy</p>}
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
                <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span>{formatCurrency(subtotal, restaurant.currency)}</span>
              </div>
              {restaurant.isTaxEnabled && tableSession.applyTax && (
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>VAT / Tax ({restaurant.taxRate}%)</span>
                  <span>{formatCurrency(taxAmount, restaurant.currency)}</span>
                </div>
              )}
              {restaurant.isServiceChargeEnabled && tableSession.applyServiceCharge && (
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>Service Charge ({restaurant.serviceChargeRate}%)</span>
                  <span>{formatCurrency(serviceChargeAmount, restaurant.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-lg pt-2 border-t mt-2">
                <span>Total</span>
                <span className="text-orange-600">{formatCurrency(total, restaurant.currency)}</span>
              </div>
            </div>

            {/* Table info */}
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center">
              <p className="text-sm text-orange-700">
                Ordering for <strong>Table {table.tableNumber}</strong> at {restaurant.name}
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
                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Placing Order...</>
              ) : (
                `Place Order · ${formatCurrency(total, restaurant.currency)}`
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
