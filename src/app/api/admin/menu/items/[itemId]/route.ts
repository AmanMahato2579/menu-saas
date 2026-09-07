import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const patchSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  price: z.coerce.number().min(0).optional(),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  isAvailable: z.boolean().optional(),
  hasSpicyOption: z.boolean().optional(),
  hasNoteOption: z.boolean().optional(),
  ingredients: z.string().optional().nullable(),
  discountPercent: z.coerce.number().int().min(0).max(100).optional(),
  variants: z.array(z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(50),
    price: z.coerce.number().positive(),
    foodType: z.enum(["VEG", "NON_VEG", "NONE"]).optional().nullable(),
    isAvailable: z.boolean().optional(),
  })).max(20).optional(),
});

async function getRestaurantId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { restaurantId?: string | null })?.restaurantId ?? null;
}

/** The item-level food type is derived from its variants (no separate input). */
function deriveFoodType(variants: { foodType?: string | null }[]): "VEG" | "NON_VEG" | "NONE" {
  if (variants.some((v) => v.foodType === "NON_VEG")) return "NON_VEG";
  if (variants.some((v) => v.foodType === "VEG")) return "VEG";
  return "NONE";
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;
  const existing = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { variants, ...rest } = parsed.data;
  const updateData = { ...rest } as Prisma.MenuItemUpdateInput;
  if (parsed.data.imageUrl === "") updateData.imageUrl = null;

  if (variants && variants.length > 0 && (!updateData.price || Number(updateData.price) <= 0)) {
    updateData.price = variants[0].price;
  }

  // Sync variants in place: keep the same row ids whenever possible so that
  // per-variant availability and existing order-item links are preserved.
  // Only variants that were removed from the submitted list are deleted.
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  if (variants) {
    if (variants.length === 0) {
      updateData.foodType = "NONE";
      ops.push(prisma.menuItemVariant.deleteMany({ where: { menuItemId: itemId } }));
    } else {
      updateData.foodType = deriveFoodType(variants);

      const current = await prisma.menuItemVariant.findMany({ where: { menuItemId: itemId } });
      const currentById = new Map(current.map((v) => [v.id, v]));
      const validIds = new Set<string>();
      for (const v of variants) {
        if (v.id && currentById.has(v.id)) validIds.add(v.id);
      }

      ops.push(
        prisma.menuItemVariant.deleteMany({
          where: { menuItemId: itemId, id: { notIn: [...validIds] } },
        })
      );

      for (const v of variants) {
        if (v.id && validIds.has(v.id)) {
          ops.push(
            prisma.menuItemVariant.update({
              where: { id: v.id },
              data: {
                name: v.name,
                price: v.price,
                foodType: v.foodType ?? null,
                isAvailable: v.isAvailable ?? true,
              },
            })
          );
        } else {
          ops.push(
            prisma.menuItemVariant.create({
              data: {
                menuItemId: itemId,
                name: v.name,
                price: v.price,
                foodType: v.foodType ?? null,
                isAvailable: v.isAvailable ?? true,
              },
            })
          );
        }
      }
    }
  }

  ops.push(prisma.menuItem.update({ where: { id: itemId }, data: updateData }));

  const updated = await prisma.$transaction(ops);
  return NextResponse.json(updated[updated.length - 1]);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;
  const existing = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.menuItem.delete({ where: { id: itemId } });
  return NextResponse.json({ success: true });
}
