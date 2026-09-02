"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Minus, Plus } from "lucide-react";
import type { CartItem } from "@/types";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  ingredients: string | null;
  discountPercent: number;
  hasSpicyOption: boolean;
  hasNoteOption: boolean;
}

interface Props {
  item: MenuItem;
  currency: string;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
}

export default function MenuItemModal({ item, currency, onClose, onAddToCart }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [isSpicy, setIsSpicy] = useState(false);
  const [note, setNote] = useState("");

  const basePrice = parseFloat(item.price);
  const price = item.discountPercent > 0 
    ? basePrice - (basePrice * item.discountPercent / 100) 
    : basePrice;
  const total = price * quantity;

  const handleAdd = () => {
    onAddToCart({
      menuItemId: item.id,
      menuItemName: item.name,
      price,
      quantity,
      isSpicy: item.hasSpicyOption ? isSpicy : false,
      note: item.hasNoteOption ? note.trim() : "",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Image */}
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-32 bg-gradient-to-r from-orange-100 to-amber-50 flex items-center justify-center text-5xl">
            🍽️
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow"
        >
          <X className="w-4 h-4 text-gray-700" />
        </button>

        <div className="p-6 space-y-5">
          {/* Title + Price */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{item.name}</h2>
              {item.description && (
                <p className="text-sm text-gray-500 mt-1">{item.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end">
              {item.discountPercent > 0 && (
                <span className="text-sm text-gray-400 line-through">
                  {formatCurrency(basePrice, currency)}
                </span>
              )}
              <p className="text-xl font-bold text-orange-600 shrink-0">
                {formatCurrency(price, currency)}
              </p>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Quantity</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-orange-400 transition-colors"
              >
                <Minus className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-xl font-bold w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Spice */}
          {item.hasSpicyOption && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Spice Level</p>
              <div className="flex gap-3">
                {[
                  { value: false, label: "🌿 Normal" },
                  { value: true, label: "🌶️ Spicy" },
                ].map(({ value, label }) => (
                  <button
                    key={label}
                    onClick={() => setIsSpicy(value)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                      isSpicy === value
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {item.hasNoteOption && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Special Instructions</p>
              <Textarea
                placeholder="e.g. Less spicy, extra chutney..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          )}

          {/* Add to Cart */}
          <Button
            onClick={handleAdd}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white h-14 rounded-2xl text-base font-bold shadow-lg shadow-orange-500/30"
          >
            Add to Cart · {formatCurrency(total, currency)}
          </Button>
        </div>
      </div>
    </div>
  );
}
