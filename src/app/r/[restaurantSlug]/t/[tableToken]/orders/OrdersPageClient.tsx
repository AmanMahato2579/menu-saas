"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatCurrency, formatDate, getOrderStatusColor } from "@/lib/utils";
import { t, orderStatusLabel } from "@/lib/i18n";
import { useCustomerLanguage, LanguageToggle } from "@/hooks/use-customer-lang";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Clock, ChefHat, XCircle, Loader2 } from "lucide-react";

const ITEM_ICON: Record<string, React.ReactNode> = {
  NEW: <Clock className="w-4 h-4" />,
  PREPARING: <ChefHat className="w-4 h-4" />,
  SERVED: <CheckCircle2 className="w-4 h-4" />,
  CANCELLED: <XCircle className="w-4 h-4" />,
};

interface OrderItem {
  id: string;
  menuItemName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  isSpicy: boolean;
  note: string | null;
  status: string;
  servedQuantity: number;
}

interface Order {
  id: string;
  orderNumber: number;
  status: string;
  total: string;
  createdAt: string;
  orderItems: OrderItem[];
}

interface Props {
  restaurant: { id: string; name: string; currency: string; language?: string };
  table: { tableNumber: number };
  orders: Order[];
  tableSession: { id: string };
}

export default function OrdersPageClient({ restaurant, table, orders: initialOrders, tableSession }: Props) {
  const params = useParams();
  const [lang, setLang] = useCustomerLanguage(restaurant.id, restaurant.language ?? "EN");
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const prevOrdersRef = useRef<Order[]>(initialOrders);
  const baseUrl = `/r/${params.restaurantSlug}/t/${params.tableToken}`;

  // Rejected orders are hidden from the customer.
  const visibleOrders = orders.filter((order) => order.status !== "REJECTED");

  const refreshOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/customer/sessions/${tableSession.id}/orders`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const previouslyRejected = new Set(
          prevOrdersRef.current.filter((o) => o.status === "REJECTED").map((o) => o.id)
        );
        const newlyRejected = data.find(
          (o: Order) => o.status === "REJECTED" && !previouslyRejected.has(o.id)
        );
        prevOrdersRef.current = data;
        if (newlyRejected) {
          router.push(baseUrl);
          return;
        }
        setOrders(data);
      }
    } catch {}
  }, [tableSession.id, router, baseUrl]);

  useEffect(() => {
    const interval = setInterval(refreshOrders, 3000);
    return () => clearInterval(interval);
  }, [refreshOrders]);

  const allItems = visibleOrders.flatMap((o) => o.orderItems);
  const awaiting = allItems.filter((i) => i.status === "NEW").length;
  const preparing = allItems.filter((i) => i.status === "PREPARING").length;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={baseUrl}>
            <button className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="font-bold text-gray-900">{t(lang, "My Orders", "मेरा अर्डरहरू")}</h1>
            <p className="text-xs text-gray-400">{t(lang, `Table ${table.tableNumber}`, `टेबल ${table.tableNumber}`)} · {restaurant.name}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle lang={lang} onChange={setLang} variant="light" />
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              {t(lang, "Live", "प्रत्यक्ष")}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Live summary */}
        {visibleOrders.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-2xl font-black text-sky-600">{awaiting}</p>
              <p className="text-[11px] text-gray-500 font-medium">{t(lang, "Not started", "सुरु नभएको")}</p>
            </div>
            <div className="text-center flex-1 border-x border-gray-100">
              <p className="text-2xl font-black text-orange-500">{preparing}</p>
              <p className="text-[11px] text-gray-500 font-medium">{t(lang, "In the kitchen", "किचनमा")}</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-2xl font-black text-green-600">
                {allItems.filter((i) => i.status === "SERVED").length}
              </p>
              <p className="text-[11px] text-gray-500 font-medium">{t(lang, "Served", "सेवा गरियो")}</p>
            </div>
          </div>
        )}

        {visibleOrders.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Loader2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">{t(lang, "No orders yet", "अहिलेसम्म कुनै अर्डर छैन")}</p>
            <p className="text-sm mt-1">{t(lang, "Your orders will appear here once placed", "अर्डर गरेपछि यहाँ देखिनेछ")}</p>
            <Link href={baseUrl} className="inline-block mt-4 text-orange-500 font-medium hover:underline">
              {t(lang, "Browse Menu →", "मेनु हेर्नुहोस् →")}
            </Link>
          </div>
        ) : (
          visibleOrders.map((order) => {
            const servedItems = order.orderItems.filter((i) => i.status === "SERVED").length;

            return (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Order header */}
                <div className="p-4 border-b flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{t(lang, "Order", "अर्डर")} #{order.orderNumber}</p>
                    <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {order.status === "PENDING" && (
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 border text-xs">
                        {t(lang, "Awaiting confirmation", "पुष्टि कुरिरहेको")}
                      </Badge>
                    )}
                    {order.status === "ACCEPTED" && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 border text-xs">
                        {t(lang, "In progress", "प्रगतिमा")}
                      </Badge>
                    )}
                    <span className="text-[11px] text-gray-400 font-medium">
                      {servedItems}/{order.orderItems.length} {t(lang, "items served", "वस्तुहरू सेवा भयो")}
                    </span>
                  </div>
                </div>

                {/* Items with per-item status */}
                <div className="p-4 space-y-2.5">
                  {order.orderItems.map((item) => {
                    const served = item.servedQuantity ?? 0;
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-gray-800 font-medium">
                              {item.menuItemName}
                              {item.variantName && <span className="text-gray-400 font-normal"> ({item.variantName})</span>}
                              <span className="text-gray-400 font-normal"> × {item.quantity}</span>
                            </span>
                            <Badge className={`${getOrderStatusColor(item.status)} border text-[10px] px-2 py-0.5`}>
                              {ITEM_ICON[item.status]}
                              {orderStatusLabel(item.status, lang)}
                            </Badge>
                          </div>
                          {item.isSpicy && <span className="text-red-500 text-xs">🌶️ {t(lang, "Spicy", "पिरो")}</span>}
                          {served > 0 && served < item.quantity && (
                            <span className="text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 ml-1">
                              {t(lang, "Served", "सेवा गरियो")} {served} {t(lang, "of", "मध्ये")} {item.quantity}
                            </span>
                          )}
                          {item.note && <p className="text-xs text-gray-400 italic mt-0.5">&quot;{item.note}&quot;</p>}
                        </div>
                        <span className="text-sm font-medium text-gray-700 shrink-0">
                          {formatCurrency(item.subtotal, restaurant.currency)}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between font-bold text-gray-900 pt-2 border-t">
                    <span>{t(lang, "Total", "कुल")}</span>
                    <span className="text-orange-600">{formatCurrency(order.total, restaurant.currency)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {visibleOrders.length > 0 && (
          <>
            <Link
              href={baseUrl}
              className="block border-2 border-orange-500 text-orange-600 rounded-2xl p-4 text-center font-bold hover:bg-orange-50 transition-colors"
            >
              {t(lang, "Add more food", "अझै खाना थप्नुहोस्")}
            </Link>
            <Link
              href={`${baseUrl}/bill`}
              className="block bg-orange-500 text-white rounded-2xl p-4 text-center font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20 mt-4"
            >
              {t(lang, "View Full Bill →", "पूरा बिल हेर्नुहोस् →")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}