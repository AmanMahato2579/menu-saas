"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatCurrency, formatDate, getOrderStatusLabel, getOrderStatusColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Clock, Loader2, ChefHat, Package, XCircle } from "lucide-react";

const STATUS_STEPS = ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED"] as const;

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="w-4 h-4" />,
  ACCEPTED: <CheckCircle className="w-4 h-4" />,
  PREPARING: <ChefHat className="w-4 h-4" />,
  READY: <Package className="w-4 h-4" />,
  COMPLETED: <CheckCircle className="w-4 h-4" />,
  REJECTED: <XCircle className="w-4 h-4" />,
};

interface Order {
  id: string;
  orderNumber: number;
  status: string;
  total: string;
  createdAt: string;
  orderItems: {
    id: string;
    menuItemName: string;
    quantity: number;
    unitPrice: string;
    subtotal: string;
    isSpicy: boolean;
    note: string | null;
  }[];
}

interface Props {
  restaurant: { name: string; currency: string };
  table: { tableNumber: number };
  orders: Order[];
  tableSession: { id: string };
}

export default function OrdersPageClient({ restaurant, table, orders: initialOrders, tableSession }: Props) {
  const params = useParams();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const baseUrl = `/r/${params.restaurantSlug}/t/${params.tableToken}`;

  // Poll for order status updates
  const refreshOrders = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/customer/sessions/${tableSession.id}/orders`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch {}
  }, [tableSession.id]);

  useEffect(() => {
    const interval = setInterval(refreshOrders, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [refreshOrders]);

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={baseUrl}>
            <button className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="font-bold text-gray-900">My Orders</h1>
            <p className="text-xs text-gray-400">Table {table.tableNumber} · {restaurant.name}</p>
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs text-green-600">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">No orders yet</p>
            <p className="text-sm mt-1">Your orders will appear here once placed</p>
            <Link href={baseUrl} className="inline-block mt-4 text-orange-500 font-medium hover:underline">
              Browse Menu →
            </Link>
          </div>
        ) : (
          orders.map((order) => {
            const currentStepIdx = STATUS_STEPS.indexOf(order.status as typeof STATUS_STEPS[number]);
            const isRejected = order.status === "REJECTED";

            return (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Order Header */}
                <div className="p-4 border-b flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-lg">Order #{order.orderNumber}</p>
                    <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
                  </div>
                  <Badge className={`${getOrderStatusColor(order.status)} border text-xs`}>
                    {getOrderStatusLabel(order.status)}
                  </Badge>
                </div>

                {/* Status Steps */}
                {!isRejected ? (
                  <div className="px-4 py-4 border-b">
                    <div className="flex items-center gap-1">
                      {STATUS_STEPS.map((step, i) => {
                        const isDone = i <= currentStepIdx;
                        const isCurrent = i === currentStepIdx;
                        return (
                          <div key={step} className="flex-1 flex flex-col items-center">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                                isDone
                                  ? isCurrent
                                    ? "bg-orange-500 text-white ring-4 ring-orange-100"
                                    : "bg-green-500 text-white"
                                  : "bg-gray-100 text-gray-400"
                              }`}
                            >
                              {STATUS_ICONS[step]}
                            </div>
                            <p className={`text-[10px] mt-1 text-center ${isDone ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                              {getOrderStatusLabel(step)}
                            </p>
                            {i < STATUS_STEPS.length - 1 && (
                              <div className={`h-0.5 w-full mt-1 rounded ${i < currentStepIdx ? "bg-green-400" : "bg-gray-100"}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3 bg-red-50 border-b text-sm text-red-600 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    This order was rejected by the restaurant.
                  </div>
                )}

                {/* Items */}
                <div className="p-4 space-y-2">
                  {order.orderItems.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
                      <div>
                        <span className="text-gray-800">{item.menuItemName} × {item.quantity}</span>
                        {item.isSpicy && <span className="text-red-500 ml-1 text-xs">🌶️</span>}
                        {item.note && <p className="text-xs text-gray-400 italic">&quot;{item.note}&quot;</p>}
                      </div>
                      <span className="font-medium text-gray-700 shrink-0">
                        {formatCurrency(item.subtotal, restaurant.currency)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-gray-900 pt-2 border-t">
                    <span>Total</span>
                    <span className="text-orange-600">{formatCurrency(order.total, restaurant.currency)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Bill CTA */}
        {orders.length > 0 && (
          <Link
            href={baseUrl}
            className="block border-2 border-orange-500 text-orange-600 rounded-2xl p-4 text-center font-bold hover:bg-orange-50 transition-colors"
          >
            Add more food
          </Link>
        )}
        {orders.length > 0 && (
          <Link
            href={`${baseUrl}/bill`}
            className="block bg-orange-500 text-white rounded-2xl p-4 text-center font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20 mt-4"
          >
            View Full Bill →
          </Link>
        )}
      </div>
    </div>
  );
}
