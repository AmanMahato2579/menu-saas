"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Pencil, Trash2, Flame, StickyNote, ChevronDown, ChevronRight } from "lucide-react";

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
  variants?: { id: string; name: string; price: string }[];
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

export default function MenuPageClient({ categories, restaurantId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(categories.map((c) => [c.id, true]))
  );

  const toggleExpand = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

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

  const toggleAvailability = async (itemId: string, current: boolean) => {
    const res = await fetch(`/api/admin/menu/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !current }),
    });
    if (res.ok) {
      toast({ title: current ? "Item marked unavailable" : "Item marked available", variant: "success" });
      startTransition(() => router.refresh());
    }
  };

  if (categories.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <p className="text-gray-500 text-lg font-medium">No categories yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Start by creating a category, then add menu items.
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
      {categories.map((category) => (
        <Card key={category.id} className="overflow-hidden">
          <CardHeader
            className="py-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleExpand(category.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
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
              <Link
                href={`/admin/menu/items/new?categoryId=${category.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Button size="sm" variant="outline" className="text-xs">
                  + Add Item
                </Button>
              </Link>
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
                      className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors"
                    >
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
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                          {item.hasSpicyOption && (
                            <Flame className="w-3.5 h-3.5 text-red-400" />
                          )}
                          {item.hasNoteOption && (
                            <StickyNote className="w-3.5 h-3.5 text-blue-400" />
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-gray-400 truncate">{item.description}</p>
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
    </div>
  );
}
