"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { computeBill, flattenSessionOrders } from "@/lib/session-math";
import type { BillConfig, SessionOrder } from "@/lib/session-math";
import ItemActions from "@/components/admin/ItemActions";
import AddFoodModal from "@/components/admin/AddFoodModal";
import BillModal from "@/components/admin/BillModal";
import { Badge } from "@/components/ui/badge";
import { ChefHat, ChevronLeft, Loader2, Plus, Receipt, User } from "lucide-react";

interface WorkspaceTable {
  id: string;
  tableNumber: number;
}

interface SessionMeta {
  id: string;
  customerName: string | null;
  status: string;
  applyTax: boolean;
  applyServiceCharge: boolean;
}

interface WaiterVariant {
  id: string;
  name: string;
  price: string;
  foodType?: string | null;
}

interface WaiterMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  ingredients: string | null;
  discountPercent: number;
  hasSpicyOption: boolean;
  hasNoteOption: boolean;
  requiresPreparation: boolean;
  variants?: WaiterVariant[];
}

interface WaiterMenuCategory {
  id: string;
  name: string;
  description: string | null;
  menuItems: WaiterMenuItem[];
}

interface Props {
  table: WorkspaceTable;
  initialSession: (SessionMeta & { orders?: SessionOrder[] }) | null;
  initialOrders: SessionOrder[];
  menu: WaiterMenuCategory[];
  currency: string;
  lang: string;
  isTaxEnabled: boolean;
  taxRate: number;
  isServiceChargeEnabled: boolean;
  serviceChargeRate: number;
}

export default function TableWorkspace({
  table,
  initialSession,
  initialOrders,
  menu,
  currency,
  lang,
  isTaxEnabled,
  taxRate,
  isServiceChargeEnabled,
  serviceChargeRate,
}: Props) {
  const router = useRouter();
  const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(() =>
    initialSession
      ? {
          id: initialSession.id,
          customerName: initialSession.customerName,
          status: initialSession.status,
          applyTax: initialSession.applyTax,
          applyServiceCharge: initialSession.applyServiceCharge,
        }
      : null
  );
  const [orders, setOrders] = useState<SessionOrder[]>(initialOrders);
  const [addOpen, setAddOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [pollFailed, setPollFailed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSession = useCallback(async () => {
    if (!sessionMeta) return;
    try {
      const res = await fetch(`/api/admin/sessions/${sessionMeta.id}/overview`, { cache: "no-store" });
      if (res.status === 404) {
        setSessionMeta(null);
        setOrders([]);
        return;
      }
      if (!res.ok) {
        setPollFailed(true);
        return;
      }
      const data = await res.json();
      setPollFailed(false);
      setSessionMeta({
        id: data.id,
        customerName: data.customerName,
        status: data.status,
        applyTax: data.applyTax,
        applyServiceCharge: data.applyServiceCharge,
      });
      setOrders(data.orders ?? []);
    } catch {
      setPollFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionMeta?.id]);

  useEffect(() => {
    if (!sessionMeta) return;
    const initial = setTimeout(loadSession, 0);
    pollRef.current = setInterval(loadSession, 3000);
    return () => {
      clearTimeout(initial);
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionMeta?.id]);

  const billCfg: BillConfig = useMemo(
    () => ({
      currency,
      isTaxEnabled,
      taxRate,
      isServiceChargeEnabled,
      serviceChargeRate,
      applyTax: sessionMeta?.applyTax ?? false,
      applyServiceCharge: sessionMeta?.applyServiceCharge ?? false,
    }),
    [currency, isTaxEnabled, taxRate, isServiceChargeEnabled, serviceChargeRate, sessionMeta]
  );

  const items = useMemo(() => flattenSessionOrders(orders), [orders]);
  const bill = useMemo(() => computeBill(items, billCfg), [items, billCfg]);

  const newItems = items.filter((i) => i.status === "NEW");
  const preparing = items.filter((i) => i.status === "PREPARING");
  const served = items.filter((i) => i.status === "SERVED");
  const cancelled = items.filter((i) => i.status === "CANCELLED");

  const isClosed = sessionMeta?.status === "CLOSED";

  const section = (label: string, itemList: typeof items, className: string, icon?: React.ReactNode) =>
    itemList.length > 0 && (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
          <h3 className="text-sm font-bold text-gray-700">
            {label}{" "}
            <span className="text-gray-400 font-medium">({itemList.length})</span>
          </h3>
          {icon}
        </div>
        <div className="space-y-2.5">
          {itemList.map((item) => (
            <ItemActions key={item.id} item={item} currency={currency} lang={lang} onChange={loadSession} />
          ))}
        </div>
      </div>
    );

  const handleAdded = (sessionId?: string) => {
    router.refresh();
    if (!sessionId) return;
    setSessionMeta({
      id: sessionId,
      customerName: null,
      status: "ACTIVE",
      applyTax: true,
      applyServiceCharge: true,
    });
    setTimeout(loadSession, 0);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/admin/service"
                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-gray-900">Table {table.tableNumber}</h1>
                  {sessionMeta && (
                    <Badge
                      className={`${
                        isClosed
                          ? "bg-gray-100 text-gray-600 border-gray-200"
                          : "bg-green-100 text-green-700 border-green-200"
                      } border`}
                    >
                      {isClosed ? t(lang, "Closed", "बन्द") : t(lang, "Open", "खुला")}
                    </Badge>
                  )}
                </div>
                {sessionMeta?.customerName && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                    <User className="w-3 h-3" /> {sessionMeta.customerName}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setAddOpen(true)}
                className={`h-11 px-4 rounded-xl text-sm font-bold text-white flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 ${
                  isClosed ? "bg-gray-400" : "bg-orange-500 hover:bg-orange-600 shadow-orange-500/30"
                }`}
              >
                <Plus className="w-4 h-4" /> {lang === "NEP" ? "थप्नुहोस्" : "Add Food"}
              </button>
              {sessionMeta && !isClosed && (
                <button
                  onClick={() => setBillOpen(true)}
                  className="h-11 px-4 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 flex items-center gap-1.5 shadow-lg shadow-green-600/30 transition-transform active:scale-95"
                >
                  <Receipt className="w-4 h-4" /> {lang === "NEP" ? "बिल" : "Bill"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-6">
        {pollFailed && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">
            Connection lost — retrying…
          </div>
        )}

        {!sessionMeta ? (
          /* No active session */
          <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-10 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-50 flex items-center justify-center text-3xl mb-4">
              <ChefHat className="w-8 h-8 text-orange-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">
              Table {table.tableNumber} — {lang === "NEP" ? "खाली छ" : "no active session"}
            </h2>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              {lang === "NEP"
                ? "पाहुनाले QR स्क्यान गर्दा वा तलको बटनबाट सेसन सुरु हुन्छ।"
                : "Start one now, or let a customer scan the QR on this table."}
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="mx-auto h-12 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-lg flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> {lang === "NEP" ? "अर्डर सुरु गर्नुहोस्" : "Start Order"}
            </button>
          </div>
        ) : isClosed ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-10 text-center">
            <p className="text-4xl mb-3">🧾</p>
            <h2 className="text-lg font-bold text-gray-800">
              {lang === "NEP" ? "सेसन बन्द भयो" : "Session closed"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {lang === "NEP"
                ? "यो टेबल अर्को पाहुनाका लागि तयार छ।"
                : "This table is ready for its next guests."}
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-6 h-11 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold"
            >
              <Plus className="w-4 h-4 inline-block mr-1 -mt-0.5" />
              {lang === "NEP" ? "नयाँ सेसन सुरु गर्नुहोस्" : "Start New Session"}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-orange-200 p-10 text-center">
            <p className="text-4xl mb-3">🍽️</p>
            <h2 className="text-lg font-bold text-gray-800">
              {lang === "NEP" ? "केही अर्डर भएको छैन" : "Nothing ordered yet"}
            </h2>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              {lang === "NEP"
                ? "टेबल {0} मा खाना थप्नुहोस्".replace("{0}", String(table.tableNumber))
                : `Add food to Table ${table.tableNumber}`}
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="mx-auto h-12 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-lg flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> {lang === "NEP" ? "खाना थप्नुहोस्" : "Add Food"}
            </button>
          </div>
        ) : (
          <>
            {section(
              lang === "NEP" ? "नयाँ" : "New",
              newItems,
              "bg-sky-500",
              newItems.length > 0 && (
                <span className="text-[11px] text-white bg-sky-500 rounded-full px-2 py-0.5 animate-pulse">
                  {lang === "NEP" ? "पूरा गर्न बाँकी" : "to complete"}
                </span>
              )
            )}
            {section(lang === "NEP" ? "तयारीमा" : "Preparing", preparing, "bg-orange-500")}
            {section(lang === "NEP" ? "सेवा भयो" : "Served", served, "bg-green-500")}
            {cancelled.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <h3 className="text-sm font-bold text-gray-500 line-through">
                    {lang === "NEP" ? "रद्द" : "Cancelled"} ({cancelled.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {cancelled.map((item) => (
                    <ItemActions key={item.id} item={item} currency={currency} lang={lang} onChange={loadSession} />
                  ))}
                </div>
              </div>
            )}

            {/* Loader while session reconnects / ends */}
            {pollFailed && (
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> {lang === "NEP" ? "जडान भइरहेको" : "Reconnecting…"}
              </div>
            )}
          </>
        )}
      </div>

      {sessionMeta && (
        <BillModal
          open={billOpen}
          onClose={() => setBillOpen(false)}
          sessionId={sessionMeta.id}
          tableNumber={table.tableNumber}
          isClosed={isClosed}
          ordersCount={orders.length}
          bill={bill}
          currency={currency}
          lang={lang}
          taxEnabled={isTaxEnabled}
          taxRate={taxRate}
          serviceChargeEnabled={isServiceChargeEnabled}
          serviceChargeRate={serviceChargeRate}
          applyTax={sessionMeta.applyTax}
          applyServiceCharge={sessionMeta.applyServiceCharge}
          onMutated={() => {
            setSessionMeta(null);
            setOrders([]);
            router.refresh();
          }}
        />
      )}

      <AddFoodModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        tableId={table.id}
        tableNumber={table.tableNumber}
        currency={currency}
        lang={lang}
        menu={menu}
        onAdded={handleAdded}
      />
    </div>
  );
}