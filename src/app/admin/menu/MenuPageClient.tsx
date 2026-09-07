"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Pencil, Trash2, Flame, StickyNote, ChevronDown, ChevronRight, GripVertical, Power } from "lucide-react";

interface Variant {
  id: string;
  name: string;
  price: string;
  isAvailable: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
  hasSpicyOption: boolean;
  hasNoteOption: boolean;
  discountPercent: number;
  foodType: string | null;
  variants?: Variant[];
}

interface Category {
  id: string;
  name: string;
  isActive: boolean;
  menuItems: MenuItem[];
}

interface Props {
  categories: Category[];
  restaurantId: string;
}

type DragPayload = { kind: "category" | "item"; id: string; categoryId?: string };

function moveInArray<T>(arr: T[], from: number, to: number): T[] {
  if (from === to) return arr;
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function readDragPayload(e: React.DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData("text/plain");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

export default function MenuPageClient({ categories, restaurantId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [cats, setCats] = useState<Category[]>(categories);
  const [view, setView] = useState<"manage" | "availability">("manage");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(categories.map((c) => [c.id, true]))
  );
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Keep local ordering/availability in sync with fresh server data (after
  // router.refresh()) using the "adjust state during render" pattern, so the
  // list reflects persisted changes without forcing the user to reload.
  const [prevCategories, setPrevCategories] = useState(categories);
  if (prevCategories !== categories) {
    setPrevCategories(categories);
    setCats(categories);
  }

  const toggleExpand = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // ─── Availability ─────────────────────────────────────────────────────────

  const toggleAvailability = async (itemId: string, current: boolean) => {
    const next = !current;
    setCats((prev) =>
      prev.map((c) => ({
        ...c,
        menuItems: c.menuItems.map((i) => (i.id === itemId ? { ...i, isAvailable: next } : i)),
      }))
    );
    const res = await fetch(`/api/admin/menu/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: next }),
    });
    if (res.ok) {
      toast({ title: next ? "Item marked available" : "Item marked unavailable", variant: "success" });
      startTransition(() => router.refresh());
    }
  };

  const toggleVariantAvailability = async (itemId: string, variantId: string, current: boolean) => {
    const next = !current;
    setCats((prev) =>
      prev.map((c) => ({
        ...c,
        menuItems: c.menuItems.map((i) =>
          i.id === itemId
            ? {
                ...i,
                variants: i.variants?.map((v) =>
                  v.id === variantId ? { ...v, isAvailable: next } : v
                ),
              }
            : i
        ),
      }))
    );
    const res = await fetch(`/api/admin/menu/items/${itemId}/variants/${variantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: next }),
    });
    if (res.ok) {
      toast({ title: next ? "Variant marked available" : "Variant marked unavailable", variant: "success" });
      startTransition(() => router.refresh());
    } else {
      toast({ title: "Error", variant: "destructive", description: "Could not update variant." });
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm("Delete this menu item?")) return;
    const res = await fetch(`/api/admin/menu/items/${itemId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Item deleted", variant: "success" });
      startTransition(() => router.refresh());
    } else {
      toast({ title: "Error", variant: "destructive", description: "Could not delete item." });
    }
  };

  // ─── Drag & drop sorting ──────────────────────────────────────────────────

  const persistCategoryOrder = async (ordered: Category[]) => {
    const res = await fetch("/api/admin/menu/categories/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: ordered.map((c) => c.id) }),
    });
    if (!res.ok) {
      setCats(categories);
      toast({ title: "Error", variant: "destructive", description: "Could not save category order." });
      return;
    }
    toast({ title: "Category order saved", variant: "success" });
    startTransition(() => router.refresh());
  };

  const persistItemOrder = async (categoryId: string, ordered: MenuItem[]) => {
    const res = await fetch("/api/admin/menu/items/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, order: ordered.map((i) => i.id) }),
    });
    if (!res.ok) {
      setCats(categories);
      toast({ title: "Error", variant: "destructive", description: "Could not save item order." });
      return;
    }
    toast({ title: "Item order saved", variant: "success" });
    startTransition(() => router.refresh());
  };

  const onCategoryDragOver = (e: React.DragEvent, categoryId: string) => {
    const payload = readDragPayload(e);
    if (payload?.kind === "category" && payload.id !== categoryId) {
      e.preventDefault();
      setDragOverId(categoryId);
    }
  };

  const onCategoryDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const payload = readDragPayload(e);
    if (payload?.kind !== "category" || payload.id === targetId) return;

    const fromIndex = cats.findIndex((c) => c.id === payload.id);
    const toIndex = cats.findIndex((c) => c.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = moveInArray(cats, fromIndex, toIndex);
    setCats(next);
    persistCategoryOrder(next);
  };

  const onItemDragOver = (e: React.DragEvent, targetId: string, categoryId: string) => {
    const payload = readDragPayload(e);
    if (payload?.kind === "item" && payload.id !== targetId && payload.categoryId === categoryId) {
      e.preventDefault();
      setDragOverId(targetId);
    }
  };

  const onItemDrop = (e: React.DragEvent, targetId: string, categoryId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const payload = readDragPayload(e);
    if (payload?.kind !== "item" || payload.id === targetId) return;

    const category = cats.find((c) => c.id === categoryId);
    if (!category) return;

    const fromIndex = category.menuItems.findIndex((i) => i.id === payload.id);
    const toIndex = category.menuItems.findIndex((i) => i.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const items = moveInArray(category.menuItems, fromIndex, toIndex);
    const next = cats.map((c) => (c.id === categoryId ? { ...c, menuItems: items } : c));
    setCats(next);
    persistItemOrder(categoryId, items);
  };

  if (cats.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <p className="text-gray-500 text-lg font-medium">No categories yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Start by creating a category, then add menu items. Drag categories to reorder them.
          </p>
          <Link href="/admin/menu/categories">
            <Button className="mt-4 bg-orange-500 hover:bg-orange-600 text-white">
              Create Category
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            onClick={() => setView("manage")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === "manage" ? "bg-orange-500 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Manage Menu
          </button>
          <button
            onClick={() => setView("availability")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === "availability" ? "bg-orange-500 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Power className="inline w-3.5 h-3.5 mr-1" />
            Availability
          </button>
        </div>
        <span className="text-xs text-gray-400">
          {view === "manage"
            ? "Drag to reorder · toggle availability"
            : "On/Off for items & each variant"}
        </span>
      </div>

      {view === "availability" ? (
        <AvailabilityView
          categories={cats}
          onToggleItem={toggleAvailability}
          onToggleVariant={toggleVariantAvailability}
        />
      ) : (
      <div className="space-y-4">
      {cats.map((category) => (
        <Card
          key={category.id}
          className={`overflow-hidden ${dragOverId === category.id ? "ring-2 ring-orange-400" : ""}`}
          onDragOver={(e) => onCategoryDragOver(e, category.id)}
          onDrop={(e) => onCategoryDrop(e, category.id)}
          onDragLeave={() => setDragOverId(null)}
        >
          <CardHeader
            className="py-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleExpand(category.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "category", id: category.id }));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-orange-400 transition-colors"
                  title="Drag to reorder"
                >
                  <GripVertical className="w-4 h-4" />
                </span>
                {expanded[category.id] ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <CardTitle className="text-base">{category.name}</CardTitle>
                <Badge variant={category.isActive ? "success" : "secondary"}>
                  {category.isActive ? "Active" : "Inactive"}
                </Badge>
                <span className="text-sm text-gray-400">
                  {category.menuItems.length} items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/menu/categories?edit=${category.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-400 hover:text-orange-500 transition-colors"
                  title="Edit category"
                >
                  <Pencil className="w-4 h-4" />
                </Link>
                <Link
                  href={`/admin/menu/items/new?categoryId=${category.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button size="sm" variant="outline" className="text-xs">
                    + Add Item
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>

          {expanded[category.id] && (
            <CardContent className="p-0">
              {category.menuItems.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm border-t">
                  No items in this category yet.
                </div>
              ) : (
                <div className="divide-y border-t">
                  {category.menuItems.map((item) => (
                    <div
                      key={item.id}
                      onDragOver={(e) => onItemDragOver(e, item.id, category.id)}
                      onDrop={(e) => onItemDrop(e, item.id, category.id)}
                      onDragLeave={() => setDragOverId(null)}
                      className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors ${
                        dragOverId === item.id ? "bg-orange-50" : ""
                      }`}
                    >
                      {/* Drag handle */}
                      <span
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "text/plain",
                            JSON.stringify({ kind: "item", id: item.id, categoryId: category.id })
                          );
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-orange-400 transition-colors shrink-0"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-4 h-4" />
                      </span>

                      {/* Image */}
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-300 text-xl">
                          🍽️
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                          {item.hasSpicyOption && (
                            <Flame className="w-3.5 h-3.5 text-red-400" />
                          )}
                          {item.hasNoteOption && (
                            <StickyNote className="w-3.5 h-3.5 text-blue-400" />
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            item.foodType === "NON_VEG"
                              ? "bg-red-100 text-red-700"
                              : item.foodType === "NONE"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-green-100 text-green-700"
                          }`}>
                            {item.foodType === "NON_VEG"
                              ? "🔴 Non-Veg"
                              : item.foodType === "NONE"
                              ? "⚪ Other"
                              : "🟢 Veg"}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-gray-400 truncate">{item.description}</p>
                        )}
                        {item.variants && item.variants.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {item.variants.map((variant) => (
                              <button
                                key={variant.id}
                                onClick={() => toggleVariantAvailability(item.id, variant.id, variant.isAvailable)}
                                title="Toggle variant availability"
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border transition-colors ${
                                  variant.isAvailable
                                    ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                    : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                                }`}
                              >
                                {variant.isAvailable ? "🟢" : "⚪"}{" "}
                                {variant.name} · {formatCurrency(variant.price)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Price */}
                      <p className="font-semibold text-gray-900 text-sm shrink-0">
                        {formatCurrency(item.price)}
                      </p>

                      {/* Available toggle */}
                      <button
                        onClick={() => toggleAvailability(item.id, item.isAvailable)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
                          item.isAvailable
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {item.isAvailable ? "Available" : "Unavailable"}
                      </button>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Link href={`/admin/menu/items/${item.id}/edit`}>
                          <button className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        </Link>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}

      <p className="text-xs text-gray-400 text-center">
        Drag the <GripVertical className="inline w-3.5 h-3.5" /> handle to reorder categories and items.
      </p>
      </div>
      )}
    </div>
  );
}

interface AvailabilityViewProps {
  categories: Category[];
  onToggleItem: (itemId: string, current: boolean) => void;
  onToggleVariant: (itemId: string, variantId: string, current: boolean) => void;
}

function AvailabilityView({ categories, onToggleItem, onToggleVariant }: AvailabilityViewProps) {
  return (
    <div className="space-y-6">
      {categories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-gray-400">
            No categories yet.
          </CardContent>
        </Card>
      ) : (
        categories.map((category) => (
          <Card key={category.id} className="overflow-hidden">
            <CardHeader className="py-3 px-5 bg-gray-50/80">
              <CardTitle className="text-sm font-semibold text-gray-700">
                {category.name}
                <span className="ml-2 text-xs font-normal text-gray-400">
                  {category.menuItems.length} items
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {category.menuItems.length === 0 ? (
                <p className="py-6 text-center text-gray-400 text-sm">No items.</p>
              ) : (
                <div className="divide-y">
                  {category.menuItems.map((item) => (
                    <div key={item.id} className="px-5 py-3">
                      {/* Item row */}
                      <div className="flex items-center gap-3">
                        <p className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                          <span className="ml-2 text-xs text-gray-400">{formatCurrency(item.price)}</span>
                        </p>
                        <Switch
                          checked={item.isAvailable}
                          onCheckedChange={() => onToggleItem(item.id, item.isAvailable)}
                          aria-label={`Toggle ${item.name}`}
                        />
                      </div>

                      {/* Variants */}
                      {item.variants && item.variants.length > 0 && (
                        <div className="mt-2 ml-4 space-y-1.5 border-l-2 border-gray-100 pl-4">
                          {item.variants.map((variant) => (
                            <div key={variant.id} className="flex items-center gap-3">
                              <p className="flex-1 min-w-0">
                                <span className="text-sm text-gray-700">{variant.name}</span>
                                <span className="ml-2 text-xs text-gray-400">
                                  {formatCurrency(variant.price)}
                                </span>
                              </p>
                              <Switch
                                checked={variant.isAvailable}
                                onCheckedChange={() => onToggleVariant(item.id, variant.id, variant.isAvailable)}
                                aria-label={`Toggle ${item.name} - ${variant.name}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}