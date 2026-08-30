"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { Pencil, Trash2, Plus, Loader2, X } from "lucide-react";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  description: z.string().optional(),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

type CategoryForm = z.infer<typeof categorySchema>;

interface Category {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  _count: { menuItems: number };
}

interface Props {
  categories: Category[];
  restaurantId: string;
}

export default function CategoriesClient({ categories: initialCategories, restaurantId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema) as unknown as Resolver<CategoryForm>,
    defaultValues: { isActive: true, displayOrder: 0 },
  });

  const isActive = watch("isActive");

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setShowForm(true);
    reset({
      name: cat.name,
      description: cat.description ?? "",
      displayOrder: cat.displayOrder,
      isActive: cat.isActive,
    });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    reset({ isActive: true, displayOrder: 0 });
  };

  const onSubmit = async (data: CategoryForm) => {
    const url = editingId
      ? `/api/admin/menu/categories/${editingId}`
      : "/api/admin/menu/categories";
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast({ title: editingId ? "Category updated" : "Category created", variant: "success" });
      cancelForm();
      startTransition(() => router.refresh());
    } else {
      const err = await res.json();
      toast({ title: "Error", variant: "destructive", description: err.error ?? "Something went wrong" });
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Delete this category? All menu items in it will also be deleted.")) return;
    const res = await fetch(`/api/admin/menu/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Category deleted", variant: "success" });
      startTransition(() => router.refresh());
    } else {
      toast({ title: "Error", variant: "destructive", description: "Could not delete." });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: List */}
      <div className="lg:col-span-2 space-y-3">
        {initialCategories.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-gray-400">
              No categories yet. Create your first one →
            </CardContent>
          </Card>
        ) : (
          initialCategories.map((cat) => (
            <Card key={cat.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4 py-4 px-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{cat.name}</p>
                    <Badge variant={cat.isActive ? "success" : "secondary"}>
                      {cat.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {cat.description && (
                    <p className="text-sm text-gray-400 truncate">{cat.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {cat._count.menuItems} items · Order #{cat.displayOrder}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(cat)}
                    className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="p-2 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            variant="outline"
            className="w-full border-dashed border-2 h-12 text-gray-500 hover:border-orange-400 hover:text-orange-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        )}
      </div>

      {/* Right: Form */}
      {showForm && (
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {editingId ? "Edit Category" : "New Category"}
                </CardTitle>
                <button onClick={cancelForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cat-name">Name *</Label>
                  <Input id="cat-name" placeholder="e.g. Momo, Drinks" {...register("name")} />
                  {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cat-desc">Description</Label>
                  <Input id="cat-desc" placeholder="Optional description" {...register("description")} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cat-order">Display Order</Label>
                  <Input id="cat-order" type="number" placeholder="0" {...register("displayOrder")} />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(val) => setValue("isActive", val)}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
