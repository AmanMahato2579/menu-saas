"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { computeBill, flattenSessionOrders } from "@/lib/session-math";
import type { SessionBill, SessionOrder } from "@/lib/session-math";
import ItemActions from "@/components/admin/ItemActions";
import BillModal from "@/components/admin/BillModal";
import { Check, Loader2, Users, Receipt, ClipboardList, AlertTriangle } from "lucide-react";

interface SessionItemData {
  id: string;
  menuItemName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  isSpicy: boolean;
  note: string | null;
  status: string;
  servedQuantity: number;
  menuItem?: { requiresPreparation?: boolean | null } | null;
}

interface OrderData {
  id: string;
  orderNumber: number;
  status: string;
  source: string;
  createdAt: string;
  orderItems: SessionItemData[];
}

interface SessionData {
  id: string;
  status: string;
  customerName: string | null;
  applyTax: boolean;
  applyServiceCharge: boolean;
  startedAt: string;
  table: { tableNumber: number };
  orders: OrderData[];
}

interface Restaurant {
  id: string;
  name: string;
  currency: string;
  isTaxEnabled: boolean;
  taxRate: number;
  isServiceChargeEnabled: boolean;
  serviceChargeRate: number;
  language?: string;
}

interface Props {
  sessions: SessionData[];
  restaurant?: Restaurant;
}

export default function OrdersClient({ sessions, restaurant }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const lang = restaurant?.language ?? "EN";
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [billFor, setBillFor] = useState<{ session: SessionData; bill: SessionBill } | null>(null);
  const [view, setView] = useState<"running" | "all">("running");
  const [, startTransition] = useTransition();

  // Auto-refresh via router.refresh() so the kitchen always sees the latest item states.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!updatingOrderId) startTransition(() => router.refresh());
    }, 3000);
    return () => clearInterval(interval);
  }, [router, updatingOrderId]);

  const changeOrderStatus = async (orderId: string, status: string) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({
        title:
          status === "ACCEPTED"
            ? t(lang, "Order accepted ✓", "अर्डर स्वीकृत ✓")
            : t(lang, "Order rejected", "अर्डर अस्वीकृत"),
        variant: status === "ACCEPTED" ? "success" : "destructive",
      });
      startTransition(() => router.refresh());
    } catch {
      toast({ title: t(lang, "Error", "त्रुटि"), variant: "destructive", description: t(lang, "Could not update the order.", "अर्डर अपडेट गर्न सकिएन।") });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const derived = useMemo(() => {
    const visible = sessions.filter((s) => (view === "running" ? s.status === "ACTIVE" : true));
    const withStats = visible.map((s) => {
      const items = flattenSessionOrders(s.orders as unknown as SessionOrder[]);
      const bill = computeBill(items, {
        currency: restaurant?.currency ?? "NPR",
        isTaxEnabled: restaurant?.isTaxEnabled ?? false,
        taxRate: Number(restaurant?.taxRate ?? 0),
        isServiceChargeEnabled: restaurant?.isServiceChargeEnabled ?? false,
        serviceChargeRate: Number(restaurant?.serviceChargeRate ?? 0),
        applyTax: s.applyTax,
        applyServiceCharge: s.applyServiceCharge,
      });
      return { session: s, items, bill };
    });
    withStats.sort((a, b) => {
      const aUnserved = a.bill.unservedCount;
      const bUnserved = b.bill.unservedCount;
      if (aUnserved > 0 && bUnserved === 0) return -1;
      if (bUnserved > 0 && aUnserved === 0) return 1;
      if (aUnserved !== bUnserved) return bUnserved - aUnserved;
      return new Date(b.session.startedAt).getTime() - new Date(a.session.startedAt).getTime();
    });
    const totalUnserved = withStats.filter((x) => x.session.status === "ACTIVE").reduce((sum, x) => sum + x.bill.unservedCount, 0);
    return { withStats, totalUnserved, visibleCount: withStats.length };
  }, [sessions, view, restaurant]);

  const open = derived.withStats;

  const renderPendingCallout = (s: SessionData) => {
    const pendingOrders = s.orders.filter((o) => o.status === "PENDING");
    if (pendingOrders.length === 0) return null;
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 space-y-2">
        <p className="text-xs font-bold text-yellow-800 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> {t(lang, "Awaiting acceptance — customer order(s)", "स्वीकारको पर्खाइमा — ग्राहकको अर्डर")}
        </p>
        {pendingOrders.map((order) => (
          <div key={order.id} className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">#{order.orderNumber}</p>
              <p className="text-xs text-gray-600 truncate">
                {order.orderItems.map((i) => `${i.menuItemName}×${i.quantity}`).join(", ")}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => changeOrderStatus(order.id, "ACCEPTED")}
                disabled={updatingOrderId === order.id}
                className="h-9 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"
              >
                {updatingOrderId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {t(lang, "Accept", "स्वीकार गर्नुहोस्")}
              </button>
              <button
                onClick={() => {
                  if (window.confirm(t(lang, "Reject this order?", "यो अर्डर अस्वीकार गर्ने हो?"))) changeOrderStatus(order.id, "REJECTED");
                }}
                disabled={updatingOrderId === order.id}
                className="h-9 px-4 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold disabled:opacity-50"
              >
                {t(lang, "Reject", "अस्वीकार")}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderItemSection = (label: string, itemList: typeof derived.withStats[0]["items"], ringClass: string) => {
    if (itemList.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${ringClass}`} />
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
            {label} ({itemList.length})
          </p>
        </div>
        <div className="space-y-2">
          {itemList.map((item) => (
            <ItemActions key={item.id} item={item} currency={restaurant?.currency ?? "NPR"} lang={lang} onChange={() => startTransition(() => router.refresh())} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("running")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
            view === "running" ? "bg-orange-500 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {t(lang, "Running", "चालू")} {derived.visibleCount > 0 && view === "running" && `(${derived.visibleCount})`}
        </button>
        <button
          onClick={() => setView("all")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
            view === "all" ? "bg-orange-500 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {t(lang, "All Sessions (24h)", "सबै सेसनहरू (२४ घण्टा)")} {view === "all" && `(${derived.visibleCount})`}
        </button>
      </div>

      {derived.totalUnserved > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-2.5 text-sm text-sky-800 font-semibold flex items-center gap-2">
          🏃 {derived.totalUnserved} {t(lang, "item(s) waiting in the kitchen queue", "वस्तुहरू किचन क्युमा पर्खिरहेका छन्")}
        </div>
      )}

      {open.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <ClipboardList className="w-12 h-12 text-orange-300 mx-auto mb-3" />
          <p className="text-base font-semibold text-gray-600">
            {view === "running"
              ? t(lang, "No active orders right now", "अहिले कुनै चालू अर्डर छैन")
              : t(lang, "No sessions in the last 24 hours", "पछिल्लो २४ घण्टामा कुनै सेसन छैन")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {open.map(({ session, items, bill }) => (
            <div key={session.id} className="rounded-2xl border-2 bg-white p-4 space-y-3">
              {/* Session header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold text-gray-900">#{session.table.tableNumber}</span>
                  <Badge className={`${session.status === "ACTIVE" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"} border`}>
                    {session.status === "ACTIVE" ? t(lang, "Open", "खुला") : t(lang, "Closed", "बन्द")}
                  </Badge>
                  {session.customerName && (
                    <span className="text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Users className="w-3 h-3" /> {session.customerName}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 font-medium">{session.orders.length} {session.orders.length !== 1 ? "orders" : "order"}</span>
              </div>

              {/* Pending acceptance */}
              {renderPendingCallout(session)}

              {/* Item sections */}
              {renderItemSection(t(lang, "New", "नयाँ"), items.filter((i) => i.status === "NEW"), "bg-sky-500")}
              {renderItemSection(t(lang, "Preparing", "तयारीमा"), items.filter((i) => i.status === "PREPARING"), "bg-orange-500")}
              {renderItemSection(t(lang, "Served", "सेवा भयो"), items.filter((i) => i.status === "SERVED"), "bg-green-500")}
              {items.filter((i) => i.status === "CANCELLED").length > 0 &&
                renderItemSection(t(lang, "Cancelled", "रद्द"), items.filter((i) => i.status === "CANCELLED"), "bg-red-400")}

              {items.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4 italic">—</p>
              )}

              {/* Footer: bill */}
              <div className="border-t pt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">
                  {t(lang, "Total", "कुल")}: {formatCurrency(bill.total, restaurant?.currency)}
                </span>
                <button
                  onClick={() => setBillFor({ session, bill })}
                  className="h-9 px-3.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Receipt className="w-4 h-4" /> {t(lang, "Bill", "बिल")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {billFor && (
        <BillModal
          open
          onClose={() => setBillFor(null)}
          sessionId={billFor.session.id}
          tableNumber={billFor.session.table.tableNumber}
          isClosed={billFor.session.status === "CLOSED"}
          ordersCount={billFor.session.orders.length}
          bill={billFor.bill}
          currency={restaurant?.currency ?? "NPR"}
          lang={lang}
          taxEnabled={restaurant?.isTaxEnabled ?? false}
          taxRate={Number(restaurant?.taxRate ?? 0)}
          serviceChargeEnabled={restaurant?.isServiceChargeEnabled ?? false}
          serviceChargeRate={Number(restaurant?.serviceChargeRate ?? 0)}
          applyTax={billFor.session.applyTax}
          applyServiceCharge={billFor.session.applyServiceCharge}
          onMutated={() => startTransition(() => router.refresh())}
        />
      )}
    </div>
  );
}