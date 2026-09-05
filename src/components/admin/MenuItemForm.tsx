"use client";

import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
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
  price: z.coerce.number().min(0, "Price cannot be negative").optional().default(0),
  imageUrl: z.string().trim().optional().or(z.literal("")),
  isAvailable: z.boolean().default(true),
  hasSpicyOption: z.boolean().default(false),
  hasNoteOption: z.boolean().default(true),
  ingredients: z.string().optional(),
  discountPercent: z.coerce.number().int().min(0).max(100).default(0),
  foodType: z.enum(["VEG", "NON_VEG"]).default("VEG"),
  variants: z.array(z.object({
    name: z.string().min(1, "Variant name is required"),
    price: z.coerce.number().positive("Variant price must be positive"),
    foodType: z.enum(["VEG", "NON_VEG"]).default("VEG"),
  })).default([]),
}).superRefine((data, ctx) => {
  if ((!data.variants || data.variants.length === 0) && (!data.price || data.price <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please enter a price or add at least one variant.",
      path: ["price"],
    });
  }
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
  ingredients: string | null;
  discountPercent: number;
  isAvailable: boolean;
  hasSpicyOption: boolean;
  hasNoteOption: boolean;
  foodType: string | null;
  variants?: { id: string; name: string; price: string; foodType?: string | null }[];
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
    control,
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
      ingredients: item?.ingredients ?? "",
      discountPercent: item?.discountPercent ?? 0,
      isAvailable: item?.isAvailable ?? true,
      hasSpicyOption: item?.hasSpicyOption ?? false,
      hasNoteOption: item?.hasNoteOption ?? true,
      foodType: (item?.foodType === "NON_VEG" ? "NON_VEG" : "VEG") as "VEG" | "NON_VEG",
      variants: item?.variants?.map((variant) => ({
        name: variant.name,
        price: Number(variant.price),
        foodType: (variant.foodType === "NON_VEG" ? "NON_VEG" : "VEG") as "VEG" | "NON_VEG",
      })) ?? [],
    },
  });
  const { fields: variants, append: addVariant, remove: removeVariant } = useFieldArray({ control, name: "variants" });

  const isAvailable = watch("isAvailable");
  const hasSpicyOption = watch("hasSpicyOption");
  const hasNoteOption = watch("hasNoteOption");
  const foodType = watch("foodType");
  const watchedVariants = watch("variants");

  const onSubmit = async (data: ItemForm) => {
    const url = item ? `/api/admin/menu/items/${item.id}` : "/api/admin/menu/items";
    const method = item ? "PATCH" : "POST";
    const normalizedImageUrl = data.imageUrl?.trim() ?? "";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, imageUrl: normalizedImageUrl || null }),
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
            <Input id="name" placeholder="e.g. Momo / Pizza" {...register("name")} />
            {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Delicious steamed dumplings served with authentic tomato chutney"
              rows={3}
              {...register("description")}
            />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="price">
                {watchedVariants && watchedVariants.length > 0 ? "Base Price (Rs.) (Optional)" : "Price (Rs.) *"}
              </Label>
              {watchedVariants && watchedVariants.length > 0 && (
                <span className="text-[11px] text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                  Auto-set from 1st variant if left empty
                </span>
              )}
            </div>
            <Input
              id="price"
              type="number"
              step="1"
              min="0"
              placeholder={watchedVariants && watchedVariants.length > 0 ? "Auto-filled from variants" : "180"}
              {...register("price")}
              className="appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {errors.price && <p className="text-red-500 text-xs">{errors.price.message}</p>}
          </div>

          {/* Variants Block */}
          <div className="space-y-3 rounded-xl border bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Item Variants (Optional)</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add different portions or types (e.g. Veg / Chicken / Buff, Half / Full), each with its own price & Veg/Non-Veg option.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-white hover:bg-orange-50 border-orange-200 text-orange-600 font-semibold shrink-0"
                onClick={() => addVariant({ name: "", price: 0, foodType: foodType || "VEG" })}
              >
                + Add Variant
              </Button>
            </div>

            {variants.length > 0 && (
              <div className="space-y-2 pt-1">
                {variants.map((variant, index) => (
                  <div key={variant.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white p-2.5 rounded-lg border shadow-sm">
                    <Input
                      placeholder="Variant Name (e.g. Veg Momo / Half)"
                      {...register(`variants.${index}.name`)}
                      className="flex-1 min-w-[130px]"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Price (Rs.)"
                      {...register(`variants.${index}.price`)}
                      className="w-28"
                    />
                    <select
                      {...register(`variants.${index}.foodType`)}
                      className="w-32 h-10 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="VEG">🟢 Veg</option>
                      <option value="NON_VEG">🔴 Non-Veg</option>
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
                      onClick={() => removeVariant(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {errors.variants && <p className="text-red-500 text-xs mt-1">Check variant names and prices.</p>}
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
            <Label htmlFor="ingredients">Ingredients</Label>
            <Input id="ingredients" placeholder="e.g. Chicken, Flour, Spices" {...register("ingredients")} />
            <p className="text-xs text-gray-400">Comma-separated ingredients</p>
          </div>

          {/* Discount */}
          <div className="space-y-1.5">
            <Label htmlFor="discountPercent">Discount (%)</Label>
            <Input
              id="discountPercent"
              type="number"
              step="1"
              min="0"
              max="100"
              placeholder="0"
              {...register("discountPercent")}
              className="appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {errors.discountPercent && <p className="text-red-500 text-xs">{errors.discountPercent.message}</p>}
          </div>

          {/* Food Type */}
          <div className="space-y-2 rounded-xl border bg-gray-50 p-3">
            <Label>Food Type</Label>
            <div className="flex gap-3">
              <label className={`relative flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-lg border-2 py-2.5 text-sm font-medium transition-all ${
                foodType !== "NON_VEG" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
              }`}>
                <input
                  type="radio"
                  value="VEG"
                  {...register("foodType")}
                  className="sr-only"
                />
                <span className="text-lg">🟢</span> Veg
              </label>
              <label className={`relative flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-lg border-2 py-2.5 text-sm font-medium transition-all ${
                foodType === "NON_VEG" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
              }`}>
                <input
                  type="radio"
                  value="NON_VEG"
                  {...register("foodType")}
                  className="sr-only"
                />
                <span className="text-lg">🔴</span> Non-Veg
              </label>
            </div>
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
