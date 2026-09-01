"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, getOrderStatusColor, getOrderStatusLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Loader2, FlameKindling, X, AlertTriangle, Users, StopCircle } from "lucide-react";

const STATUS_TABS = [
  { label: "All", value: undefined },
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
    customerName?: string | null;
    table: {
      tableNumber: number;
    };
  };
  orderItems: OrderItem[];
}

interface Props {
  orders: Order[];
  currentStatus?: string;
  restaurantId: string;
}

// ── Friction Confirmation Modal ────────────────────────────────────────────────
function ConfirmCompleteModal({
  orderNumber,
  onConfirm,
  onCancel,
  loading,
}: {
  orderNumber: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [input, setInput] = useState("");
  const isValid = input.trim().toUpperCase() === "DONE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Mark Order #{orderNumber} Complete?</p>
            <p className="text-xs text-gray-500">Confirm only after payment is settled.</p>
          </div>
          <button onClick={onCancel} className="ml-auto text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Type <span className="font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">DONE</span> to confirm this order was served and paid for:
        </p>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type DONE to confirm"
          className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-mono mb-4 focus:outline-none focus:border-green-500 transition-colors"
        />
        <div className="flex gap-3">
          <Button
            onClick={onConfirm}
            disabled={!isValid || loading}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mark Completed"}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── End Session Confirmation ───────────────────────────────────────────────────
function ConfirmEndSessionModal({
  tableNumber,
  customerName,
  onConfirm,
  onCancel,
  loading,
}: {
  tableNumber: number;
  customerName?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [input, setInput] = useState("");
  const isValid = input.trim().toUpperCase() === "END";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <StopCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900">End Table {tableNumber} Session?</p>
            {customerName && <p className="text-xs text-gray-500">Guest: {customerName}</p>}
          </div>
          <button onClick={onCancel} className="ml-auto text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          This clears the table for the next guest. Type{" "}
          <span className="font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">END</span> to confirm:
        </p>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type END to confirm"
          className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-mono mb-4 focus:outline-none focus:border-red-500 transition-colors"
        />
        <div className="flex gap-3">
          <Button
            onClick={onConfirm}
            disabled={!isValid || loading}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "End Session"}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function OrdersClient({ orders, currentStatus }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Friction modals
  const [completeModal, setCompleteModal] = useState<Order | null>(null);
  const [endSessionModal, setEndSessionModal] = useState<{ sessionId: string; tableNumber: number; customerName?: string | null } | null>(null);
  const [endingSession, setEndingSession] = useState(false);

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: "Order updated", variant: "success", description: `Status → ${getOrderStatusLabel(newStatus)}` });
      startTransition(() => router.refresh());
    } catch {
      toast({ title: "Error", variant: "destructive", description: "Could not update order status." });
    } finally {
      setUpdatingId(null);
      setCompleteModal(null);
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

  const endSession = async () => {
    if (!endSessionModal) return;
    setEndingSession(true);
    try {
      const res = await fetch(`/api/admin/sessions/${endSessionModal.sessionId}/close`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Session ended", variant: "success", description: `Table ${endSessionModal.tableNumber} is now free.` });
        setEndSessionModal(null);
        startTransition(() => router.refresh());
      } else {
        toast({ title: "Error", variant: "destructive", description: "Could not end session." });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setEndingSession(false);
    }
  };

  return (
    <div>
      {/* ── Sticky Status Tabs ── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-0.5 max-w-full">
          {STATUS_TABS.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => {
                const url = value ? `/admin/orders?status=${value}` : "/admin/orders";
                router.push(url);
              }}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                currentStatus === value
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <ClipboardListEmpty />
          <p className="text-lg font-medium text-gray-500 mt-4">No orders found</p>
          <p className="text-sm mt-1">
            {currentStatus ? `No ${getOrderStatusLabel(currentStatus)} orders` : "No orders yet today"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((order) => {
            const sessionId = order.tableSession?.id;
            const tableNumber = order.tableSession?.table?.tableNumber ?? null;
            const customerName = order.tableSession?.customerName;

            return (
              <Card key={order.id} className="relative overflow-hidden">
                {/* Status bar */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    order.status === "PENDING" ? "bg-yellow-400" :
                    order.status === "ACCEPTED" ? "bg-blue-400" :
                    order.status === "PREPARING" ? "bg-orange-400" :
                    order.status === "READY" ? "bg-green-400" :
                    order.status === "COMPLETED" ? "bg-gray-400" : "bg-red-400"
                  }`}
                />
                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900 text-lg">#{order.orderNumber}</p>
                      <p className="text-sm text-gray-500">
                        Table {tableNumber ?? "—"} · {formatDate(order.createdAt)}
                      </p>
                      {customerName && (
                        <p className="text-xs text-orange-600 flex items-center gap-1 mt-0.5">
                          <Users className="w-3 h-3" /> {customerName}
                        </p>
                      )}
                    </div>
                    <Badge className={`${getOrderStatusColor(order.status)} border text-xs`}>
                      {getOrderStatusLabel(order.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Items */}
                  <div className="space-y-1.5 bg-gray-50 rounded-lg p-3">
                    {order.orderItems.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-800">
                            {item.menuItemName}
                            {item.variantName && (
                              <span className="text-gray-500 font-normal"> ({item.variantName})</span>
                            )}
                            {" "}× {item.quantity}
                          </span>
                          {item.isSpicy && (
                            <span className="ml-2 text-xs text-red-600 font-medium">🌶 Spicy</span>
                          )}
                          {item.note && (
                            <p className="text-xs text-gray-400 italic mt-0.5">&quot;{item.note}&quot;</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-gray-700 shrink-0">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="font-bold text-gray-900 text-lg">
                      Total: {formatCurrency(order.total)}
                    </span>
                  </div>

                  {/* Actions */}
                  {NEXT_STATUS[order.status] && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        className={`flex-1 text-white h-9 ${
                          order.status === "READY"
                            ? "bg-green-500 hover:bg-green-600 ring-2 ring-green-200"
                            : "bg-orange-500 hover:bg-orange-600"
                        }`}
                        disabled={updatingId === order.id}
                        onClick={() => {
                          if (order.status === "READY") {
                            setCompleteModal(order);
                          } else {
                            updateStatus(order.id, NEXT_STATUS[order.status]);
                          }
                        }}
                      >
                        {updatingId === order.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          NEXT_STATUS_LABEL[order.status]
                        )}
                      </Button>
                      {order.status === "PENDING" && (
                        <Button
                          variant="outline"
                          className="h-9 border-red-200 text-red-600 hover:bg-red-50"
                          disabled={updatingId === order.id}
                          onClick={() => rejectOrder(order.id)}
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  )}

                  {/* End Session button — visible on READY or COMPLETED orders */}
                  {(order.status === "READY" || order.status === "COMPLETED") && sessionId && (
                    <button
                      onClick={() =>
                        setEndSessionModal({
                          sessionId,
                          tableNumber: tableNumber ?? 0,
                          customerName,
                        })
                      }
                      className="w-full text-xs text-red-500 border border-red-200 hover:bg-red-50 rounded-lg py-2 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      End Table {tableNumber} Session
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Friction: Complete confirmation modal */}
      {completeModal && (
        <ConfirmCompleteModal
          orderNumber={completeModal.orderNumber}
          onConfirm={() => updateStatus(completeModal.id, "COMPLETED")}
          onCancel={() => setCompleteModal(null)}
          loading={updatingId === completeModal.id}
        />
      )}

      {/* Friction: End session confirmation modal */}
      {endSessionModal && (
        <ConfirmEndSessionModal
          tableNumber={endSessionModal.tableNumber}
          customerName={endSessionModal.customerName}
          onConfirm={endSession}
          onCancel={() => setEndSessionModal(null)}
          loading={endingSession}
        />
      )}
    </div>
  );
}

function ClipboardListEmpty() {
  return (
    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
      <FlameKindling className="w-8 h-8 text-gray-300" />
    </div>
  );
}
