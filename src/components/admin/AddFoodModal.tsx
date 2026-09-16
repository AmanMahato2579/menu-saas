"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";
import MenuItemModal from "@/components/customer/MenuItemModal";
import type { CartItem } from "@/types";
import { Loader2, Minus, Plus, X, Trash2 } from "lucide-react";

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
  open: boolean;
  onClose: () => void;
  tableId: string;
  tableNumber: number;
  currency: string;
  lang?: string;
  menu: WaiterMenuCategory[];
  /** Called after items are successfully added — passes the (new or existing) session id. */
  onAdded: (sessionId?: string) => void;
}

export default function AddFoodModal({ open, onClose, tableId, tableNumber, currency, lang = "EN", menu, onAdded }: Props) {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<string>(menu[0]?.id ?? "");
  const [selectedModalItem, setSelectedModalItem] = useState<WaiterMenuItem | null>(null);
  const [selection, setSelection] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const activeCat = menu.find((c) => c.id === activeCategory) ?? menu[0];
  const displayedCat = activeCategory && activeCat ? activeCat : menu[0];

  const addToSelection = (item: CartItem) => {
    setSelection((prev) => {
      const idx = prev.findIndex(
        (c) => c.menuItemId === item.menuItemId && c.variantId === item.variantId && c.isSpicy === item.isSpicy && c.note === item.note
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + item.quantity };
        return next;
      }
      return [...prev, item];
    });
    setSelectedModalItem(null);
  };

  const changeQty = (idx: number, delta: number) => {
    setSelection((prev) => {
      const next = [...prev];
      const q = next[idx].quantity + delta;
      if (q > 0) {
        next[idx] = { ...next[idx], quantity: q };
        return next;
      }
      return next.filter((_, i) => i !== idx);
    });
  };

  const removeSelected = (idx: number) => {
    setSelection((prev) => prev.filter((_, i) => i !== idx));
  };

  const selectionCount = selection.reduce((s, i) => s + i.quantity, 0);
  const selectionTotal = selection.reduce((s, i) => s + i.price * i.quantity, 0);

  const submit = async () => {
    if (selection.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/tables/${tableId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selection.map((i) => ({
            menuItemId: i.menuItemId,
            variantId: i.variantId,
            quantity: i.quantity,
            isSpicy: i.isSpicy,
            note: i.note,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: t(lang, "Could not add items", "वस्तुहरू थप्न सकिएन"), variant: "destructive", description: err.error });
        return;
      }
      const created = await res.json().catch(() => ({}));
      setSelection([]);
      setSelectedModalItem(null);
      onClose();
      toast({
        title: t(lang, `Added to Table ${tableNumber} ✓`, `टेबल ${tableNumber} मा थपियो ✓`),
        variant: "success",
        description: t(lang, `${selectionCount} item(s) added`, `${selectionCount} वस्तुहरू थपियो`),
      });
      onAdded(created?.tableSession?.id);
    } catch {
      toast({ title: t(lang, "Network error", "नेटवर्क त्रुटि"), variant: "destructive", description: t(lang, "Please try again.", "कृपया फेरि प्रयास गर्नुहोस्।") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-gray-50 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-orange-500 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold">{t(lang, "Add Food", "खाना थप्नुहोस्")}</h2>
            <p className="text-xs text-orange-100">{t(lang, `Table ${tableNumber}`, `टेबल ${tableNumber}`)}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="bg-white border-b px-4 py-2.5 flex gap-2 overflow-x-auto">
          {menu.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat.id
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Items scroll area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!menu.length ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {t(lang, "No menu items available. Add items in the Menu section first.", "कुनै मेनु आइटम छैन। पहिले मेनु सेक्सनमा आइटमहरू थप्नुहोस्।")}
            </div>
          ) : (
            displayedCat?.menuItems.map((item) => {
              const price = item.discountPercent > 0
                ? parseFloat(item.price) * (1 - item.discountPercent / 100)
                : parseFloat(item.price);
              return (
                <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-3.5 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatCurrency(price, currency)}
                      {item.requiresPreparation === false && (
                        <span className="ml-2 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full">{t(lang, "Serve instantly", "झटपट सेवा")}</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedModalItem(item)}
                    className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold text-lg hover:bg-orange-600 flex items-center justify-center shrink-0"
                  >
                    +
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Selected tray */}
        {selection.length > 0 && (
          <div className="bg-white border-t px-4 py-3 max-h-48 overflow-y-auto space-y-2">
            {selection.map((sel, idx) => (
              <div key={`${sel.menuItemId}-${sel.variantId}-${idx}`} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {sel.menuItemName}
                    {sel.variantName && <span className="text-gray-500"> ({sel.variantName})</span>}
                    {sel.isSpicy && <span className="text-xs text-red-500"> 🌶️</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => changeQty(idx, -1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-bold text-sm w-5 text-center">{sel.quantity}</span>
                  <button onClick={() => changeQty(idx, 1)} className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center">
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => removeSelected(idx)} className="text-gray-300 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full mt-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-lg disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                `${t(lang, "Add to Table", "टेबलमा थप्नुहोस्")} ${tableNumber} · ${selectionCount} ${t(lang, "item(s)", "वस्तुहरू")} · ${formatCurrency(selectionTotal, currency)}`
              )}
            </button>
          </div>
        )}

        {/* Item config modal (variants / spicy / note / quantity) */}
        {selectedModalItem && (
          <MenuItemModal
            item={selectedModalItem}
            currency={currency}
            lang={lang}
            onClose={() => setSelectedModalItem(null)}
            onAddToCart={addToSelection}
          />
        )}
      </div>
    </div>
  );
}