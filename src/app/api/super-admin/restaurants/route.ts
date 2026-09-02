import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { slugify } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2),
  ownerName: z.string().min(1),
  ownerEmail: z.string().email(),
  tempPassword: z.string().min(6),
  tableCount: z.number().int().min(1).max(200),
  phone: z.string().optional(),
  address: z.string().optional(),
});

async function isSuperAdmin() {
  const session = await auth();
  return (session?.user as { role?: string })?.role === "SUPER_ADMIN";
}

export async function POST(req: Request) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, ownerName, ownerEmail, tempPassword, tableCount, phone, address } = parsed.data;

  // Generate unique slug
  let slug = slugify(name);
  const existing = await prisma.restaurant.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // Create restaurant + owner + tables in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.create({
      data: { name, slug, phone, address },
    });

    const user = await tx.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        passwordHash,
        role: "RESTAURANT_ADMIN",
        restaurantId: restaurant.id,
      },
    });

    // Create tables
    if (tableCount > 0) {
      await tx.table.createMany({
        data: Array.from({ length: tableCount }, (_, i) => ({
          restaurantId: restaurant.id,
          tableNumber: i + 1,
        })),
      });
    }

    return { restaurant, user };
  });

  return NextResponse.json(result, { status: 201 });
}
