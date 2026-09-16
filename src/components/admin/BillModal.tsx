"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import type { SessionBill } from "@/lib/session-math";
import { X, CheckCircle2, Loader2, AlertTriangle, CreditCard, Receipt } from "lucide-react";

interface BillModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  tableNumber: number;
  isClosed: boolean;
  ordersCount: number;
  bill: SessionBill;
  currency: string;
  lang?: string;
  taxEnabled: boolean;
  taxRate: number;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
  applyTax: boolean;
  applyServiceCharge: boolean;
  onMutated?: () => void;
}

export default function BillModal({
  open,
  onClose,
  sessionId,
  tableNumber,
  isClosed,
  ordersCount,
  bill,
  currency,
  lang = "EN",
  taxEnabled,
  taxRate,
  serviceChargeEnabled,
  serviceChargeRate,
  applyTax,
  applyServiceCharge,
  onMutated,
}: BillModalProps) {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);

  if (!open) return null;

  const unserved = bill.unservedCount;
  const showChargeNote = (unserved > 0 || isClosed) && confirming;

  const closeSession = async () => {
    setClosing(true);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/close`, { method: "POST" });
      if (res.ok) {
        toast({
          title: `${lang === "NEP" ? "टेबल" : "Table"} ${tableNumber} ${lang === "NEP" ? "चेकआउट भयो 🎉" : "Checked Out 🎉"}`,
          variant: "success",
        });
        onClose();
        onMutated?.();
      } else {
        toast({ title: "Error", variant: "destructive", description: "Could not checkout this table." });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive", description: "Please try again." });
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <CreditCard className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-2xl font-black">
                {lang === "NEP" ? "टेबल" : "Table"} {tableNumber} {lang === "NEP" ? "बिल" : "Bill"}
              </h3>
              <p className="text-xs text-orange-100 mt-0.5">
                {ordersCount} {ordersCount !== 1 ? "orders" : "order"} · {bill.activeCount} items
                {isClosed ? ` · ${lang === "NEP" ? "सेसन बन्द" : "Session closed"}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* SERVED */}
          <div>
            <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">✓ {lang === "NEP" ? "सेवा भएका" : "Served"}</p>
            {bill.served.length === 0 ? (
              <p className="text-xs text-gray-400 pl-1">—</p>
            ) : (
              <div className="space-y-1.5">
                {bill.served.map((it) => (
                  <div key={it.id} className="flex justify-between items-center text-sm bg-green-50/60 rounded-lg px-3 py-2">
                    <span className="text-gray-800">
                      {it.menuItemName}
                      {it.variantName && <span className="text-gray-500"> ({it.variantName})</span>}
                      <span className="text-green-700 font-bold ml-1.5">× {it.quantity}</span>
                    </span>
                    <span className="font-semibold text-gray-700">{formatCurrency(it.subtotal, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* NOT SERVED */}
          <div>
            <p className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-2">🔥 {lang === "NEP" ? "अझै सेवा बाँकी" : "Not served yet"}</p>
            {bill.newItems.length === 0 && bill.preparing.length === 0 ? (
              <p className="text-xs text-gray-400 pl-1">—</p>
            ) : (
              <div className="space-y-1.5">
                {[...bill.newItems, ...bill.preparing].map((it) => (
                  <div key={it.id} className="flex justify-between items-center text-sm bg-amber-50/60 rounded-lg px-3 py-2">
                    <span className="text-gray-800">
                      {it.menuItemName}
                      {it.variantName && <span className="text-gray-500"> ({it.variantName})</span>}
                      <span className="text-orange-600 font-bold ml-1.5">× {it.quantity}</span>
                    </span>
                    <span className="font-semibold text-gray-700">{formatCurrency(it.subtotal, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CANCELLED */}
          {bill.cancelled.length > 0 && (
            <div>
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">✕ {lang === "NEP" ? "रद्द" : "Cancelled"}</p>
              <div className="space-y-1">
                {bill.cancelled.map((it) => (
                  <div key={it.id} className="flex justify-between text-sm text-gray-400 line-through px-3 py-1">
                    <span>
                      {it.menuItemName} × {it.quantity}
                    </span>
                    <span>{formatCurrency(it.subtotal, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="bg-orange-50/60 rounded-2xl p-4 border border-orange-200 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold">{formatCurrency(bill.subtotal, currency)}</span>
            </div>
            {taxEnabled && applyTax && bill.taxAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax / VAT ({taxRate}%)</span>
                <span className="font-semibold">{formatCurrency(bill.taxAmount, currency)}</span>
              </div>
            )}
            {serviceChargeEnabled && applyServiceCharge && bill.serviceChargeAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Service Charge ({serviceChargeRate}%)</span>
                <span className="font-semibold">{formatCurrency(bill.serviceChargeAmount, currency)}</span>
              </div>
            )}
            <div className="border-t border-orange-200 pt-2 flex justify-between items-center">
              <span className="text-lg font-black text-gray-900">{lang === "NEP" ? "जम्मा" : "Grand Total"}</span>
              <span className="text-2xl font-black text-orange-600">{formatCurrency(bill.total, currency)}</span>
            </div>
          </div>

          {/* Unserved warning */}
          {!isClosed && unserved > 0 && !confirming && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-800 font-bold">
                ⚠️ {unserved} item{unserved !== 1 ? "s are" : " is"} still not served yet.
              </p>
            </div>
          )}
          {showChargeNote && unserved > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-center">
              <p className="text-xs text-red-700 font-bold flex items-center justify-center gap-1">
                <AlertTriangle className="w-4 h-4" /> {unserved} item{unserved !== 1 ? "s are" : " is"} still not served.
              </p>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t flex gap-3">
          {!isClosed && !confirming && (
            <button
              onClick={() => setConfirming(true)}
              disabled={closing}
              className="flex-1 h-12 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-extrabold text-sm shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Receipt className="w-5 h-5" />
              {lang === "NEP" ? "चेकआउट गर्नुहोस्" : "Checkout Table"} {tableNumber}
            </button>
          )}
          {!isClosed && confirming && (
            <>
              <button
                onClick={() => setConfirming(false)}
                disabled={closing}
                className="flex-1 h-12 rounded-2xl border border-gray-300 text-gray-700 font-bold text-sm"
              >
                {lang === "NEP" ? "पछाडि जानुहोस्" : "Go Back"}
              </button>
              <button
                onClick={closeSession}
                disabled={closing}
                className="flex-1 h-12 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2"
              >
                {closing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    {unserved > 0
                      ? lang === "NEP" ? "जसरी भए पनि चेकआउट" : "Checkout Anyway"
                      : lang === "NEP" ? "भुक्तानी पुष्टि गर्नुहोस्" : "Confirm Payment"}
                  </>
                )}
              </button>
            </>
          )}
          {isClosed && (
            <button
              onClick={onClose}
              className="flex-1 h-12 rounded-2xl bg-gray-600 hover:bg-gray-700 text-white font-bold text-sm"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}