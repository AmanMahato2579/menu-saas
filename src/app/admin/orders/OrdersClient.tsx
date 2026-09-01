"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, getOrderStatusColor, getOrderStatusLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Loader2, FlameKindling } from "lucide-react";

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
  READY: "Mark Completed",
};

interface OrderItem {
  id: string;
  menuItemName: string;
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

export default function OrdersClient({ orders, currentStatus, restaurantId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const updateStatus = async (orderId: string, newStatus: string) => {
    if (newStatus === "COMPLETED" && !window.confirm("Mark this order completed? Confirm only after it has been served and payment/session handling is ready.")) return;
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
    }
  };

  const rejectOrder = async (orderId: string) => {
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

  return (
    <div>
      {/* Status Tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {STATUS_TABS.map(({ label, value }) => (
          <button
            key={label}
            onClick={() => {
              const url = value ? `/admin/orders?status=${value}` : "/admin/orders";
              router.push(url);
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              currentStatus === value
                ? "bg-orange-500 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
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
          {orders.map((order) => (
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
                      Table {order.tableSession?.table?.tableNumber ?? "—"} · {formatDate(order.createdAt)}
                    </p>
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
                          {item.menuItemName} × {item.quantity}
                        </span>
                        {item.isSpicy && (
                          <span className="ml-2 text-xs text-red-600 font-medium">
                            🌶 Spicy
                          </span>
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
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white h-9"
                      disabled={updatingId === order.id}
                      onClick={() => updateStatus(order.id, NEXT_STATUS[order.status])}
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
              </CardContent>
            </Card>
          ))}
        </div>
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
