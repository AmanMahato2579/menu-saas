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

type DragKind = "category" | "item" | "variant";

interface DragState {
  kind: DragKind;
  id: string;
  /** categoryId for items, itemId for variants */
  parentId?: string;
  name: string;
}

interface OverState {
  id: string;
  before: boolean;
}

/** Move `sourceId` to sit immediately before/after `targetId` in `list`. */
function reorderList<T>(list: T[], getId: (x: T) => string, sourceId: string, targetId: string, before: boolean): T[] {
  const ids = list.map(getId);
  const s = ids.indexOf(sourceId);
  const t = ids.indexOf(targetId);
  if (s < 0 || t < 0 || s === t) return list;
  let pos = before ? t : t + 1;
  if (s < pos) pos -= 1;
  const next = [...list];
  const [moved] = next.splice(s, 1);
  next.splice(pos, 0, moved);
  return next;
}

function DropLine({ show, before }: { show: boolean; before: boolean }) {
  if (!show) return null;
  return (
    <div
      className={`pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-orange-500 shadow-sm ${
        before ? "top-0" : "bottom-0"
      }`}
    />
  );
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

  // Keep local ordering/availability in sync with fresh server data (after
  // router.refresh()) using the "adjust state during render" pattern, so the
  // list reflects persisted changes without forcing the user to reload.
  const [prevCategories, setPrevCategories] = useState(categories);
  if (prevCategories !== categories) {
    setPrevCategories(categories);
    setCats(categories);
  }

  // ─── Drag & drop state (pointer-based: mouse + touch) ──────────────────────
  const [drag, setDrag] = useState<DragState | null>(null);
  const [over, setOver] = useState<OverState | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  const rowName = (kind: DragKind, parentId: string | undefined, id: string): string => {
    if (kind === "category") return cats.find((c) => c.id === id)?.name ?? "Item";
    if (kind === "item")
      return cats.find((c) => c.id === parentId)?.menuItems.find((i) => i.id === id)?.name ?? "Item";
    return (
      cats
        .flatMap((c) => c.menuItems)
        .find((i) => i.id === parentId)
        ?.variants?.find((v) => v.id === id)?.name ?? "Item"
    );
  };

  const startDrag = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const t = e.currentTarget;
    const kind = t.getAttribute("data-grip-kind") as DragKind | null;
    const id = t.getAttribute("data-grip-id") ?? "";
    if (!kind || !id) return;
    const parentId = t.getAttribute("data-grip-parent") ?? undefined;
    try {
      t.setPointerCapture(e.pointerId);
    } catch {
      /* ignore capture errors */
    }
    setDrag({ kind, id, parentId, name: rowName(kind, parentId, id) });
    setOver(null);
    setGhostPos({ x: e.clientX, y: e.clientY });
  };

  /** Find the nearest row of the dragged kind under the pointer. */
  const findHoveredRow = (kind: DragKind, x: number, y: number): HTMLElement | null => {
    const el = document.elementFromPoint(x, y);
    if (!(el instanceof Element)) return null;
    let cur: Element | null = el;
    while (cur instanceof Element) {
      if (cur.getAttribute("data-row-kind") === kind) return cur as HTMLElement;
      cur = cur.parentElement;
    }
    return null;
  };

  const moveDrag = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!drag) return;
    setGhostPos({ x: e.clientX, y: e.clientY });
    const row = findHoveredRow(drag.kind, e.clientX, e.clientY);
    if (!row) {
      setOver(null);
      return;
    }
    const rowId = row.getAttribute("data-row-id") ?? "";
    const rowParent = row.getAttribute("data-row-parent") ?? undefined;
    if (!rowId || (drag.parentId && rowParent !== drag.parentId)) {
      setOver(null);
      return;
    }
    const rect = row.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    setOver({ id: rowId, before });
  };

  const endDrag = () => {
    const current = drag;
    const drop = over;
    setDrag(null);
    setOver(null);
    setGhostPos(null);
    if (!current || !drop || drop.id === current.id) return;

    if (current.kind === "category") {
      const next = reorderList(cats, (c) => c.id, current.id, drop.id, drop.before);
      if (next !== cats) {
        setCats(next);
        persistCategoryOrder(next);
      }
    } else if (current.kind === "item") {
      const category = cats.find((c) => c.id === current.parentId);
      if (!category) return;
      const next = reorderList(category.menuItems, (i) => i.id, current.id, drop.id, drop.before);
      if (next !== category.menuItems) {
        setCats((prev) => prev.map((c) => (c.id === category.id ? { ...c, menuItems: next } : c)));
        persistItemOrder(category.id, next);
      }
    } else if (current.kind === "variant") {
      const catOfItem = cats.find((c) => c.menuItems.some((i) => i.id === current.parentId));
      const categoryId = catOfItem?.id;
      const item = catOfItem?.menuItems.find((i) => i.id === current.parentId);
      const variants = item?.variants ?? [];
      const next = reorderList(variants, (v) => v.id, current.id, drop.id, drop.before);
      if (item && categoryId && next !== variants) {
        const catId = categoryId;
        const itemId = item.id;
        setCats((prev) =>
          prev.map((c) =>
            c.id === catId
              ? { ...c, menuItems: c.menuItems.map((i) => (i.id === itemId ? { ...i, variants: next } : i)) }
              : c
          )
        );
        persistVariantOrder(item.id, next);
      }
    }
  };

  const cancelDrag = () => {
    setDrag(null);
    setOver(null);
    setGhostPos(null);
  };

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

  // ─── Persistence ──────────────────────────────────────────────────────────

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

  const persistVariantOrder = async (itemId: string, ordered: Variant[]) => {
    const res = await fetch(`/api/admin/menu/items/${itemId}/variants/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: ordered.map((v) => v.id) }),
    });
    if (!res.ok) {
      setCats(categories);
      toast({ title: "Error", variant: "destructive", description: "Could not save variant order." });
      return;
    }
    toast({ title: "Variant order saved", variant: "success" });
    startTransition(() => router.refresh());
  };

  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

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

  const gripProps = (kind: DragKind, id: string, parentId?: string) => ({
    className:
      "cursor-grab active:cursor-grabbing text-gray-300 hover:text-orange-400 transition-colors touch-none select-none",
    title: "Drag to reorder",
    "data-grip-kind": kind,
    "data-grip-id": id,
    ...(parentId ? { "data-grip-parent": parentId } : {}),
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: cancelDrag,
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  });

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
          {cats.map((category) => {
            const catOver =
              over && drag?.kind === "category" && over.id === category.id ? over : null;
            return (
              <Card
                key={category.id}
                data-row-kind="category"
                data-row-id={category.id}
                className={`relative overflow-hidden ${
                  catOver ? "ring-2 ring-orange-400" : ""
                }`}
              >
                <CardHeader
                  className="py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(category.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span {...gripProps("category", category.id)}>
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
                      <div className="border-t">
                        {category.menuItems.map((item) => {
                          const itemOver =
                          over && drag?.kind === "item" && over.id === item.id ? over : null;
                          return (
                            <div
                              key={item.id}
                              data-row-kind="item"
                              data-row-id={item.id}
                              data-row-parent={category.id}
                              className={`relative flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors border-b last:border-b-0 ${
                                itemOver ? "bg-orange-50/70" : ""
                              }`}
                            >
                              <DropLine show={!!itemOver} before={itemOver?.before ?? false} />
                              {/* Drag handle */}
                              <span {...gripProps("item", item.id, category.id)}>
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
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                      item.foodType === "NON_VEG"
                                        ? "bg-red-100 text-red-700"
                                        : item.foodType === "NONE"
                                        ? "bg-gray-100 text-gray-700"
                                        : "bg-green-100 text-green-700"
                                    }`}
                                  >
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

                                {/* Variants (draggable, like items) */}
                                {item.variants && item.variants.length > 0 && (
                                  <div className="mt-2 flex flex-col gap-1">
                                    {item.variants.map((variant) => {
                                      const variantOver =
                                        over && drag?.kind === "variant" && over.id === variant.id ? over : null;
                                      return (
                                        <div
                                          key={variant.id}
                                          data-row-kind="variant"
                                          data-row-id={variant.id}
                                          data-row-parent={item.id}
                                          className={`relative flex items-center gap-2 rounded-md border px-1.5 py-1 ${
                                            variant.isAvailable
                                              ? "border-green-200 bg-green-50/50"
                                              : "border-gray-200 bg-gray-50"
                                          } ${
                                            variantOver ? "ring-1 ring-orange-400 bg-orange-50/70" : ""
                                          }`}
                                        >
                                          <DropLine
                                            show={!!variantOver}
                                            before={variantOver?.before ?? false}
                                          />
                                          <span {...gripProps("variant", variant.id, item.id)}>
                                            <GripVertical className="w-3.5 h-3.5" />
                                          </span>
                                          <span className="text-xs font-medium text-gray-800">
                                            {variant.name}
                                          </span>
                                          <span className="text-xs text-gray-400">
                                            {formatCurrency(variant.price)}
                                          </span>
                                          <button
                                            onClick={() =>
                                              toggleVariantAvailability(
                                                item.id,
                                                variant.id,
                                                variant.isAvailable
                                              )
                                            }
                                            title="Toggle variant availability"
                                            className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium border transition-colors ${
                                              variant.isAvailable
                                                ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                                                : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"
                                            }`}
                                          >
                                            {variant.isAvailable ? "🟢" : "⚪"}
                                          </button>
                                        </div>
                                      );
                                    })}
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
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                )}

                <DropLine show={!!catOver} before={catOver?.before ?? false} />
              </Card>
            );
          })}

          <p className="text-xs text-gray-400 text-center">
            Drag the <GripVertical className="inline w-3.5 h-3.5" /> handle to reorder categories,
            items, and item variants.
          </p>
        </div>
      )}

      {/* Drag ghost */}
      {drag && ghostPos && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 rounded-lg bg-orange-500 text-white text-xs font-medium px-3 py-1.5 shadow-lg"
          style={{ left: ghostPos.x, top: ghostPos.y }}
        >
          <GripVertical className="w-3.5 h-3.5" />
          <span>{drag.name}</span>
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
                                onCheckedChange={() =>
                                  onToggleVariant(item.id, variant.id, variant.isAvailable)
                                }
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