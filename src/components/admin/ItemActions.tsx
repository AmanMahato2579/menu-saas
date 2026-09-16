"use client";

import { useState } from "react";
import { formatCurrency, getOrderStatusColor } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { remainingQuantity } from "@/lib/session-math";
import type { SessionItem } from "@/lib/session-math";
import { CheckCircle2, Flame, Loader2, Minus, MoreVertical, Plus, Trash2, AlertTriangle } from "lucide-react";

interface ItemActionsProps {
  item: SessionItem;
  currency: string;
  lang?: string | null;
  /** Called after a successful server mutation so the parent can refresh. */
  onChange: () => void | Promise<void>;
}

const STATUS_BADGE: Record<string, string> = {
  NEW: "bg-sky-100 text-sky-800 border-sky-200",
  PREPARING: "bg-orange-100 text-orange-800 border-orange-200",
  SERVED: "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
};

export default function ItemActions({ item, currency, lang = "EN", onChange }: ItemActionsProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const pendingOrder = item.orderStatus === "PENDING";
  const served = item.servedQuantity || 0;
  const remaining = remainingQuantity(item);
  const isInstant = item.requiresPreparation === false;

  const mutate = async (action: "status" | "serve" | "quantity", body: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/order-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        toast({ title: "Error", variant: "destructive", description: err.error });
        return;
      }
      setMenuOpen(false);
      setConfirmRemove(false);
      await onChange();
    } catch {
      toast({ title: "Network error", variant: "destructive", description: "Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    mutate("status", { status: "CANCELLED", reason: "Removed by staff" });
  };

  const quantityLabel =
    item.status === "NEW" && item.requiresPreparation !== false
      ? lang === "NEP"
        ? "पकाउन सुरु गर्नुहोस्"
        : "Start Cooking"
      : lang === "NEP"
        ? "सेवा गर्नुहोस्"
        : "Serve";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm break-words">
              {item.menuItemName}
              {item.variantName && (
                <span className="text-gray-500 font-normal"> ({item.variantName})</span>
              )}
            </span>
            <Badge className={`${STATUS_BADGE[item.status] ?? getOrderStatusColor(item.status)} border text-[11px] px-2 py-0.5`}>
              {orderStatusLabel(item.status, lang)}
            </Badge>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm font-bold text-orange-600">× {item.quantity}</span>
            {served > 0 && served < item.quantity && (
              <span className="text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                {orderStatusLabel("SERVED", lang)} {served}/{item.quantity}
              </span>
            )}
            {isInstant && (
              <span className="text-[11px] font-medium bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                {lang === "NEP" ? "झटपट" : "Instant"}
              </span>
            )}
            {item.orderSource === "CUSTOMER" && (
              <span className="text-[11px] text-gray-400">📱 QR</span>
            )}
            {item.orderSource === "WAITER" && (
              <span className="text-[11px] text-gray-400">👨‍🍳 {lang === "NEP" ? "कर्मचारी" : "Staff"}</span>
            )}
            {item.isSpicy && (
              <span className="text-[11px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">🌶️ {lang === "NEP" ? "पिरो" : "Spicy"}</span>
            )}
          </div>

          {item.note && (
            <p className="text-[11px] text-amber-700 italic mt-1 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 inline-block">
              “{item.note}”
            </p>
          )}
        </div>

        <span className="text-sm font-bold text-gray-800 shrink-0">
          {formatCurrency(item.subtotal, currency)}
        </span>
      </div>

      {/* Actions */}
      {item.status === "CANCELLED" ? (
        <div className="mt-2 text-[11px] text-red-600 font-medium flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> {lang === "NEP" ? "रद्द गरियो" : "Removed from bill"}
        </div>
      ) : (
        <>
          {item.status === "SERVED" ? (
            <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-green-700">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              {lang === "NEP" ? "सेवा भयो" : "Served"} ✓
            </div>
          ) : pendingOrder ? (
            <div className="mt-2 flex items-center justify-between gap-1.5 text-[12px] font-medium text-yellow-700">
              <span className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {lang === "NEP" ? "अर्डर स्वीकार गर्नुहोस्" : "Placed — accept the order first"}
              </span>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                disabled={busy}
                className="h-8 w-8 shrink-0 rounded-lg border border-yellow-200 text-yellow-600 hover:bg-yellow-100 flex items-center justify-center"
                aria-label="Item options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() =>
                  item.status === "NEW" && item.requiresPreparation !== false
                    ? mutate("status", { status: "PREPARING" })
                    : mutate("status", { status: "SERVED" })
                }
                disabled={busy}
                className={`flex-1 h-9 rounded-lg text-xs font-bold text-white transition-transform active:scale-95 disabled:opacity-50 ${
                  item.status === "PREPARING"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : quantityLabel}
              </button>

              <button
                onClick={() => setMenuOpen((v) => !v)}
                disabled={busy}
                className="h-9 w-9 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center"
                aria-label="Item options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit menu */}
      {menuOpen && item.status !== "SERVED" && item.status !== "CANCELLED" && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
          {(item.status === "NEW" || item.status === "PREPARING") && (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-gray-600">{lang === "NEP" ? "मात्रा / घटाउनुहोस्" : "Quantity / Reduce"}</span>
                {item.status === "PREPARING" && (
                  <p className="text-[10px] text-amber-600">{lang === "NEP" ? "पकाउन सुरु गरिसकेपछि घटाउन मात्र मिल्छ" : "Already cooking — can only reduce"}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const minQty = Math.min(Math.max((item.servedQuantity || 0) + 1, 1), item.quantity);
                    if (item.quantity > minQty) {
                      mutate("quantity", { quantity: item.quantity - 1 });
                    } else if (!confirmRemove) {
                      setConfirmRemove(true);
                    } else {
                      handleRemove();
                    }
                  }}
                  className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-red-400 disabled:opacity-50"
                  disabled={busy}
                  aria-label="Reduce quantity"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-bold text-sm w-5 text-center">{item.quantity}</span>
                {item.status === "NEW" && (
                  <button
                    onClick={() => mutate("quantity", { quantity: item.quantity + 1 })}
                    className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 disabled:opacity-50"
                    disabled={busy}
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {!pendingOrder && remaining > 1 && (
            <button
              onClick={() => mutate("serve", {})}
              disabled={busy}
              className="w-full h-8 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-bold hover:bg-green-100"
            >
              {lang === "NEP" ? "अर्को १ सेवा गर्नुहोस्" : `Serve 1 more (${remaining - 1} left)`}
            </button>
          )}
          {!pendingOrder && remaining > 1 && (
            <button
              onClick={() => mutate("status", { status: "SERVED" })}
              disabled={busy}
              className="w-full h-8 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700"
            >
              {lang === "NEP" ? "सबै सेवा गर्नुहोस्" : `Serve all (${remaining})`}
            </button>
          )}

          {confirmRemove ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700">
                {lang === "NEP" ? "यो परिकार हटाउने?" : `Remove ${item.menuItemName}?`}
              </span>
              <button
                onClick={handleRemove}
                disabled={busy}
                className="h-8 px-3 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600"
              >
                {lang === "NEP" ? "हटाउनुहोस्" : "Remove"}
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="h-8 px-3 rounded-lg border border-gray-300 text-gray-600 text-xs font-bold hover:bg-white"
              >
                {lang === "NEP" ? "राख्नुहोस्" : "Keep"}
              </button>
            </div>
          ) : (
            <button
              onClick={handleRemove}
              disabled={busy}
              className={`w-full h-8 rounded-lg text-xs font-bold border ${
                item.status === "NEW"
                  ? "border-red-200 text-red-600 hover:bg-red-50"
                  : "border-amber-200 text-amber-700 hover:bg-amber-50"
              }`}
            >
              {item.status === "NEW"
                ? lang === "NEP"
                  ? "परिकार हटाउनुहोस्"
                  : "Remove item"
                : lang === "NEP"
                  ? "परिकार रद्द गर्नुहोस्"
                  : "Cancel item"}
            </button>
          )}
        </div>
      )}

      {item.status === "PREPARING" && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-orange-600">
          <Flame className="w-3 h-3" /> {lang === "NEP" ? "किचनमा" : "In the kitchen"}
        </div>
      )}
    </div>
  );
}