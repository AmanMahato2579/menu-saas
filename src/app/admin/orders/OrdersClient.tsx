"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, getOrderStatusColor, getOrderStatusLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Loader2, FlameKindling, X, Users, CheckCircle2, Receipt, CreditCard, ChevronRight } from "lucide-react";

const STATUS_TABS = [
  { label: "Running Orders", value: undefined },
  { label: "Pending", value: "PENDING" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Preparing", value: "PREPARING" },
  { label: "Ready", value: "READY" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Rejected", value: "REJECTED" },
];

const NEXT_STATUS: Record<string, string> = {
  PENDING: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Accept",
  ACCEPTED: "Mark Preparing",
  PREPARING: "Mark Ready",
  READY: "Mark Completed ✓",
};

interface OrderItem {
  id: string;
  menuItemName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  isSpicy: boolean;
  note: string | null;
}

interface Order {
  id: string;
  orderNumber: number;
  status: string;
  total: string;
  createdAt: string;
  tableSession: {
    id: string;
    status?: string;
    customerName?: string | null;
    applyTax: boolean;
    applyServiceCharge: boolean;
    table: {
      tableNumber: number;
    };
  };
  orderItems: OrderItem[];
}

interface Restaurant {
  id: string;
  name: string;
  currency: string;
  isTaxEnabled: boolean;
  taxRate: number;
  isServiceChargeEnabled: boolean;
  serviceChargeRate: number;
}

interface Props {
  orders: Order[];
  currentStatus?: string;
  restaurantId: string;
  restaurant?: Restaurant;
}

interface TableSessionSummary {
  sessionId: string;
  tableNumber: number;
  customerName?: string | null;
  applyTax: boolean;
  applyServiceCharge: boolean;
  orders: Order[];
  totalOrdersCount: number;
  completedOrdersCount: number;
  isReadyForCheckout: boolean;
  hasRunningOrders: boolean;
  items: {
    name: string;
    variantName?: string | null;
    quantity: number;
    subtotal: number;
  }[];
  subtotal: number;
  taxAmount: number;
  serviceChargeAmount: number;
  grandTotal: number;
}

export default function OrdersClient({ orders, currentStatus, restaurant }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [activeCheckoutSession, setActiveCheckoutSession] = useState<TableSessionSummary | null>(null);
  const [endingSession, setEndingSession] = useState(false);

  // Auto-refresh orders every 3 seconds to eliminate communication lag
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if no modals are open to prevent state interruptions
      if (!updatingId && !endingSession) {
        startTransition(() => {
          router.refresh();
        });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [router, updatingId, endingSession]);

  // 1-Click Update Order Status (NO TYPING!)
  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({
        title: newStatus === "COMPLETED" ? "Order Completed! ✓" : "Order Updated",
        variant: "success",
        description: `Order status set to ${getOrderStatusLabel(newStatus)}`,
      });
      startTransition(() => router.refresh());
    } catch {
      toast({ title: "Error", variant: "destructive", description: "Could not update order status." });
    } finally {
      setUpdatingId(null);
    }
  };

  const rejectOrder = async (orderId: string) => {
    if (!window.confirm("Reject this order?")) return;
    setUpdatingId(orderId);
    try {
      await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      });
      toast({ title: "Order rejected", variant: "destructive" });
      startTransition(() => router.refresh());
    } catch {
      toast({ title: "Error", variant: "destructive", description: "Could not reject order." });
    } finally {
      setUpdatingId(null);
    }
  };

  // 1-Click Session Checkout (NO TYPING!)
  const handleCompleteCheckout = async (sessionId: string, tableNumber: number) => {
    setEndingSession(true);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/close`, { method: "POST" });
      if (res.ok) {
        toast({
          title: `Table ${tableNumber} Checked Out! 🎉`,
          variant: "success",
          description: `Payment settled. Table ${tableNumber} is now free for new guests.`,
        });
        setActiveCheckoutSession(null);
        startTransition(() => router.refresh());
      } else {
        toast({ title: "Error", variant: "destructive", description: "Could not checkout session." });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setEndingSession(false);
    }
  };

  // Filter orders for display
  // 1. Requirement 1: On "All" running orders view, hide COMPLETED & REJECTED orders
  // 2. Hide orders belonging to already closed sessions
  const displayedOrders = orders.filter((order) => {
    if (order.tableSession?.status === "CLOSED") return false;
    if (currentStatus) return true; // Explicit tab selected (e.g. Completed or Rejected tab)
    return order.status !== "COMPLETED" && order.status !== "REJECTED"; // Running orders view
  });

  // Group orders by tableSession for Checkout Box
  const sessionMap = new Map<string, Order[]>();
  orders.forEach((order) => {
    // Only group sessions that are active or have active running orders
    if (order.tableSession?.status === "CLOSED" && (order.status === "COMPLETED" || order.status === "REJECTED")) return;
    const sId = order.tableSession?.id;
    if (sId) {
      const existing = sessionMap.get(sId) || [];
      existing.push(order);
      sessionMap.set(sId, existing);
    }
  });

  const sessionSummaries: TableSessionSummary[] = Array.from(sessionMap.entries()).map(
    ([sessionId, sessionOrders]) => {
      const first = sessionOrders[0];
      const tableNumber = first.tableSession?.table?.tableNumber ?? 0;
      const customerName = first.tableSession?.customerName;
      const applyTax = first.tableSession?.applyTax ?? true;
      const applyServiceCharge = first.tableSession?.applyServiceCharge ?? true;

      const nonRejected = sessionOrders.filter((o) => o.status !== "REJECTED");
      const completedOrders = sessionOrders.filter((o) => o.status === "COMPLETED" || o.status === "REJECTED");

      const hasRunningOrders = sessionOrders.some(
        (o) => o.status === "PENDING" || o.status === "ACCEPTED" || o.status === "PREPARING" || o.status === "READY"
      );

      const isReadyForCheckout = sessionOrders.length > 0 && !hasRunningOrders;

      // Consolidate all items across orders in this session
      const itemMap = new Map<string, { name: string; variantName?: string | null; quantity: number; subtotal: number }>();
      let subtotal = 0;

      nonRejected.forEach((o) => {
        o.orderItems.forEach((item) => {
          const key = `${item.menuItemName}_${item.variantName || ""}`;
          const itemSubtotal = Number(item.subtotal);
          subtotal += itemSubtotal;

          if (itemMap.has(key)) {
            const current = itemMap.get(key)!;
            current.quantity += item.quantity;
            current.subtotal += itemSubtotal;
          } else {
            itemMap.set(key, {
              name: item.menuItemName,
              variantName: item.variantName,
              quantity: item.quantity,
              subtotal: itemSubtotal,
            });
          }
        });
      });

      const taxRate = restaurant?.isTaxEnabled && applyTax ? Number(restaurant.taxRate) : 0;
      const serviceRate = restaurant?.isServiceChargeEnabled && applyServiceCharge ? Number(restaurant.serviceChargeRate) : 0;

      const taxAmount = (subtotal * taxRate) / 100;
      const serviceChargeAmount = (subtotal * serviceRate) / 100;
      const grandTotal = subtotal + taxAmount + serviceChargeAmount;

      return {
        sessionId,
        tableNumber,
        customerName,
        applyTax,
        applyServiceCharge,
        orders: sessionOrders,
        totalOrdersCount: sessionOrders.length,
        completedOrdersCount: completedOrders.length,
        isReadyForCheckout,
        hasRunningOrders,
        items: Array.from(itemMap.values()),
        subtotal,
        taxAmount,
        serviceChargeAmount,
        grandTotal,
      };
    }
  );

  // Sort sessions: Ready for checkout first, then by table number
  sessionSummaries.sort((a, b) => {
    if (a.isReadyForCheckout && !b.isReadyForCheckout) return -1;
    if (!a.isReadyForCheckout && b.isReadyForCheckout) return 1;
    return a.tableNumber - b.tableNumber;
  });

  const readyForCheckoutCount = sessionSummaries.filter((s) => s.isReadyForCheckout).length;

  return (
    <div className="space-y-6">
      {/* ── Sticky Status Filter Tabs ── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b -mx-4 sm:-mx-6 px-4 sm:px-6 py-3">
        <div className="flex gap-2 overflow-x-auto pb-0.5 max-w-full">
          {STATUS_TABS.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => {
                const url = value ? `/admin/orders?status=${value}` : "/admin/orders";
                router.push(url);
              }}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                currentStatus === value
                  ? "bg-orange-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONSOLIDATED TABLE CHECKOUT BOX (Requirement 3 & 4) ── */}
      {sessionSummaries.length > 0 && (
        <Card className="border-2 border-orange-200 bg-gradient-to-r from-orange-50/70 via-amber-50/50 to-orange-50/70 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-gray-900">
                    Table Session Checkout Box
                  </CardTitle>
                  <p className="text-xs text-gray-600">
                    All completed orders are grouped here into a single combined bill for 1-click checkout.
                  </p>
                </div>
              </div>
              {readyForCheckoutCount > 0 && (
                <Badge className="bg-green-600 text-white font-bold text-xs px-3 py-1 animate-pulse">
                  {readyForCheckoutCount} Table{readyForCheckoutCount > 1 ? "s" : ""} Ready for Checkout
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sessionSummaries.map((session) => (
                <div
                  key={session.sessionId}
                  className={`rounded-2xl p-4 border-2 transition-all flex flex-col justify-between ${
                    session.isReadyForCheckout
                      ? "bg-white border-green-500 shadow-md ring-2 ring-green-100"
                      : "bg-white/80 border-gray-200 opacity-90"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-extrabold text-gray-900">
                          Table {session.tableNumber}
                        </span>
                        {session.customerName && (
                          <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <Users className="w-3 h-3" /> {session.customerName}
                          </span>
                        )}
                      </div>
                      {session.isReadyForCheckout ? (
                        <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Ready
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full font-medium">
                          In Progress ({session.completedOrdersCount}/{session.totalOrdersCount})
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 space-y-1 mb-3 bg-gray-50 p-2.5 rounded-xl border">
                      <p className="font-semibold text-gray-700">
                        Total Items: {session.items.reduce((s, i) => s + i.quantity, 0)} ({session.items.length} dishes)
                      </p>
                      <p className="font-extrabold text-sm text-orange-600">
                        Total Bill: {formatCurrency(session.grandTotal, restaurant?.currency)}
                      </p>
                    </div>
                  </div>

                  {session.isReadyForCheckout ? (
                    <Button
                      onClick={() => setActiveCheckoutSession(session)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-11 text-sm rounded-xl shadow-md flex items-center justify-center gap-2"
                    >
                      <Receipt className="w-4 h-4" />
                      Checkout Table {session.tableNumber}
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setActiveCheckoutSession(session)}
                      className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold h-9 rounded-xl"
                    >
                      View Consolidated Bill
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── RUNNING KITCHEN ORDERS GRID ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">
            {currentStatus ? `${getOrderStatusLabel(currentStatus)} Orders` : "Running Kitchen Orders"}
          </h2>
          <span className="text-xs text-gray-500 font-medium">
            {displayedOrders.length} order{displayedOrders.length !== 1 ? "s" : ""}
          </span>
        </div>

        {displayedOrders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
            <ClipboardListEmpty />
            <p className="text-base font-semibold text-gray-600 mt-4">No active running orders</p>
            <p className="text-xs text-gray-400 mt-1">
              {currentStatus ? `No ${getOrderStatusLabel(currentStatus)} orders found.` : "All orders are served or checked out."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayedOrders.map((order) => {
              const tableNumber = order.tableSession?.table?.tableNumber ?? null;
              const customerName = order.tableSession?.customerName;

              return (
                <Card key={order.id} className="relative overflow-hidden border-2 hover:shadow-lg transition-shadow">
                  {/* Status Bar */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1.5 ${
                      order.status === "PENDING" ? "bg-yellow-400" :
                      order.status === "ACCEPTED" ? "bg-blue-500" :
                      order.status === "PREPARING" ? "bg-orange-500" :
                      order.status === "READY" ? "bg-green-500" :
                      order.status === "COMPLETED" ? "bg-gray-400" : "bg-red-500"
                    }`}
                  />
                  <CardHeader className="pb-3 pt-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-gray-900 text-xl">Order #{order.orderNumber}</p>
                          <span className="text-sm font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
                            Table {tableNumber ?? "—"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(order.createdAt)}
                        </p>
                        {customerName && (
                          <p className="text-xs text-orange-600 flex items-center gap-1 mt-1 font-medium">
                            <Users className="w-3 h-3" /> Guest: {customerName}
                          </p>
                        )}
                      </div>
                      <Badge className={`${getOrderStatusColor(order.status)} border text-xs px-2.5 py-1`}>
                        {getOrderStatusLabel(order.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Order Items */}
                    <div className="space-y-1.5 bg-gray-50 rounded-xl p-3 border">
                      {order.orderItems.map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <span className="text-sm font-semibold text-gray-800">
                              {item.menuItemName}
                              {item.variantName && (
                                <span className="text-gray-500 font-normal"> ({item.variantName})</span>
                              )}
                              <span className="text-orange-600 font-bold ml-1">× {item.quantity}</span>
                            </span>
                            {item.isSpicy && (
                              <span className="ml-2 text-xs text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">🌶 Spicy</span>
                            )}
                            {item.note && (
                              <p className="text-xs text-gray-500 italic mt-0.5 bg-amber-50 p-1 rounded border border-amber-100">
                                &quot;{item.note}&quot;
                              </p>
                            )}
                          </div>
                          <span className="text-sm font-bold text-gray-800 shrink-0">
                            {formatCurrency(item.subtotal, restaurant?.currency)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-bold text-gray-900 text-base">
                        Order Total: {formatCurrency(order.total, restaurant?.currency)}
                      </span>
                    </div>

                    {/* Requirement 2: 1-CLICK ACTION BUTTONS (NO TYPING!) */}
                    {NEXT_STATUS[order.status] && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          className={`flex-1 text-white h-11 font-bold text-sm shadow-md transition-transform active:scale-95 ${
                            order.status === "READY"
                              ? "bg-green-600 hover:bg-green-700 ring-2 ring-green-300"
                              : "bg-orange-500 hover:bg-orange-600"
                          }`}
                          disabled={updatingId === order.id}
                          onClick={() => updateStatus(order.id, NEXT_STATUS[order.status])}
                        >
                          {updatingId === order.id ? (
                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                          ) : (
                            NEXT_STATUS_LABEL[order.status]
                          )}
                        </Button>
                        {order.status === "PENDING" && (
                          <Button
                            variant="outline"
                            className="h-11 border-red-200 text-red-600 hover:bg-red-50 font-bold"
                            disabled={updatingId === order.id}
                            onClick={() => rejectOrder(order.id)}
                          >
                            Reject
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── BIG CHECKOUT & BILL POPUP MODAL (Requirements 3 & 4 — NO TYPING!) ── */}
      {activeCheckoutSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6 relative">
              <button
                onClick={() => setActiveCheckoutSession(null)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white">
                  <CreditCard className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black">
                    Table {activeCheckoutSession.tableNumber} Checkout
                  </h3>
                  <p className="text-xs text-orange-100 mt-0.5">
                    {activeCheckoutSession.customerName
                      ? `Guest: ${activeCheckoutSession.customerName}`
                      : "Dine-in Customer"} · {activeCheckoutSession.totalOrdersCount} Order{activeCheckoutSession.totalOrdersCount > 1 ? "s" : ""} Total
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body: Full Itemized Bill Receipt */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="bg-gray-50 rounded-2xl p-4 border space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Item & Quantity</span>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Subtotal</span>
                </div>
                {activeCheckoutSession.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-sm">
                    <div>
                      <p className="font-bold text-gray-900">
                        {item.name} {item.variantName && <span className="text-gray-500 font-normal">({item.variantName})</span>}
                      </p>
                      <p className="text-xs text-gray-500 font-medium">Quantity: × {item.quantity}</p>
                    </div>
                    <span className="font-bold text-gray-800">
                      {formatCurrency(item.subtotal, restaurant?.currency)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bill Totals Summary Box */}
              <div className="bg-orange-50/60 rounded-2xl p-4 border border-orange-200 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-semibold">{formatCurrency(activeCheckoutSession.subtotal, restaurant?.currency)}</span>
                </div>
                {activeCheckoutSession.taxAmount > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Tax / VAT ({restaurant?.taxRate}%)</span>
                    <span className="font-semibold">{formatCurrency(activeCheckoutSession.taxAmount, restaurant?.currency)}</span>
                  </div>
                )}
                {activeCheckoutSession.serviceChargeAmount > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Service Charge ({restaurant?.serviceChargeRate}%)</span>
                    <span className="font-semibold">{formatCurrency(activeCheckoutSession.serviceChargeAmount, restaurant?.currency)}</span>
                  </div>
                )}
                <div className="border-t border-orange-200 pt-2 flex justify-between items-center">
                  <span className="text-lg font-black text-gray-900">Grand Total</span>
                  <span className="text-2xl font-black text-orange-600">
                    {formatCurrency(activeCheckoutSession.grandTotal, restaurant?.currency)}
                  </span>
                </div>
              </div>

              {/* Warning if running orders exist */}
              {!activeCheckoutSession.isReadyForCheckout && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-800 font-bold">
                    ⚠️ Note: {activeCheckoutSession.totalOrdersCount - activeCheckoutSession.completedOrdersCount} order(s) for this table are still being prepared/ready. Please complete all kitchen orders before final checkout.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer: 1-Click Big Checkout Button (NO TYPING!) */}
            <div className="p-6 bg-gray-50 border-t flex gap-3">
              <Button
                disabled={!activeCheckoutSession.isReadyForCheckout || endingSession}
                onClick={() =>
                  handleCompleteCheckout(
                    activeCheckoutSession.sessionId,
                    activeCheckoutSession.tableNumber
                  )
                }
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-extrabold h-14 rounded-2xl text-base shadow-xl shadow-green-600/30 flex items-center justify-center gap-2"
              >
                {endingSession ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    Confirm Payment & Checkout Table {activeCheckoutSession.tableNumber}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveCheckoutSession(null)}
                disabled={endingSession}
                className="h-14 px-6 rounded-2xl font-bold border-gray-300"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClipboardListEmpty() {
  return (
    <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
      <FlameKindling className="w-8 h-8 text-orange-500" />
    </div>
  );
}
