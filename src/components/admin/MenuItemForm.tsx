"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Loader2, ArrowLeft } from "lucide-react";

const itemSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  price: z.coerce.number().positive("Price must be greater than 0"),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().default(true),
  hasSpicyOption: z.boolean().default(false),
  hasNoteOption: z.boolean().default(true),
  displayOrder: z.coerce.number().int().default(0),
});

type ItemForm = z.infer<typeof itemSchema>;

interface Category {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
  hasSpicyOption: boolean;
  hasNoteOption: boolean;
  displayOrder: number;
}

interface Props {
  categories: Category[];
  defaultCategoryId?: string;
  item?: MenuItem;
}

export default function MenuItemForm({ categories, defaultCategoryId, item }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema) as unknown as Resolver<ItemForm>,
    defaultValues: {
      categoryId: item?.categoryId ?? defaultCategoryId ?? "",
      name: item?.name ?? "",
      description: item?.description ?? "",
      price: item?.price ? parseFloat(item.price) : undefined,
      imageUrl: item?.imageUrl ?? "",
      isAvailable: item?.isAvailable ?? true,
      hasSpicyOption: item?.hasSpicyOption ?? false,
      hasNoteOption: item?.hasNoteOption ?? true,
      displayOrder: item?.displayOrder ?? 0,
    },
  });

  const isAvailable = watch("isAvailable");
  const hasSpicyOption = watch("hasSpicyOption");
  const hasNoteOption = watch("hasNoteOption");

  const onSubmit = async (data: ItemForm) => {
    const url = item ? `/api/admin/menu/items/${item.id}` : "/api/admin/menu/items";
    const method = item ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, imageUrl: data.imageUrl || null }),
    });

    if (res.ok) {
      toast({ title: item ? "Item updated!" : "Item created!", variant: "success" });
      router.push("/admin/menu");
      router.refresh();
    } else {
      const err = await res.json();
      toast({ title: "Error", variant: "destructive", description: JSON.stringify(err.error) });
    }
  };

  return (
              <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Item Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="categoryId">Category *</Label>
            <Select id="categoryId" {...register("categoryId")}>
              <option value="">Select a category</option>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </Select>
            {errors.categoryId && <p className="text-red-500 text-xs">{errors.categoryId.message}</p>}
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" placeholder="e.g. Chicken Momo" {...register("name")} />
            {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Steamed chicken dumplings served with chutney"
              rows={3}
              {...register("description")}
            />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label htmlFor="price">Price (Rs.) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="180"
              {...register("price")}
            />
            {errors.price && <p className="text-red-500 text-xs">{errors.price.message}</p>}
          </div>

          {/* Image URL */}
          <div className="space-y-1.5">
            <Label htmlFor="imageUrl">Image URL (optional)</Label>
            <Input
              id="imageUrl"
              type="url"
              placeholder="https://example.com/image.jpg"
              {...register("imageUrl")}
            />
          </div>

          {/* Display Order */}
          <div className="space-y-1.5">
            <Label htmlFor="displayOrder">Display Order</Label>
            <Input id="displayOrder" type="number" placeholder="0" {...register("displayOrder")} />
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Available</p>
                <p className="text-xs text-gray-400">Show this item to customers</p>
              </div>
              <Switch
                checked={isAvailable}
                onCheckedChange={(val) => setValue("isAvailable", val)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Spicy Option</p>
                <p className="text-xs text-gray-400">Let customers choose Normal or Spicy</p>
              </div>
              <Switch
                checked={hasSpicyOption}
                onCheckedChange={(val) => setValue("hasSpicyOption", val)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Special Instructions</p>
                <p className="text-xs text-gray-400">Allow customers to add notes</p>
              </div>
              <Switch
                checked={hasNoteOption}
                onCheckedChange={(val) => setValue("hasNoteOption", val)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : (
                item ? "Update Item" : "Create Item"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/menu")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
