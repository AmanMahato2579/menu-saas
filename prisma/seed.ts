import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = "admin@menusaas.com";
  const passwordHash = await bcrypt.hash("Admin123!", 10);

  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (!existingSuperAdmin) {
    await prisma.user.create({
      data: {
        email: superAdminEmail,
        name: "Super Admin",
        passwordHash,
        role: "SUPER_ADMIN",
      },
    });
    console.log(`Created Super Admin: ${superAdminEmail} / Admin123!`);
  }

  const restaurantAdminEmail = "owner@demo.com";
  let restaurant = await prisma.restaurant.findUnique({
    where: { slug: "demo-restaurant" },
  });

  if (!restaurant) {
    const createdRestaurant = await prisma.restaurant.create({
      data: {
        name: "Demo Momo House",
        slug: "demo-restaurant",
        description: "Authentic Nepali Momo & Fast Food",
        currency: "Rs.",
        taxRate: 13,
        isTaxEnabled: true,
        serviceChargeRate: 10,
        isServiceChargeEnabled: true,
        isActive: true,
      },
    });

    restaurant = createdRestaurant;

    await prisma.user.create({
      data: {
        email: restaurantAdminEmail,
        name: "Demo Owner",
        passwordHash: await bcrypt.hash("Owner123!", 10),
        role: "RESTAURANT_ADMIN",
        restaurantId: createdRestaurant.id,
      },
    });

    await prisma.table.createMany({
      data: Array.from({ length: 5 }).map((_, i) => ({
        restaurantId: createdRestaurant.id,
        tableNumber: i + 1,
        qrToken: `demo-table-${i + 1}`,
      })),
    });
  }

  if (!restaurant) throw new Error("Unable to create or load the demo restaurant.");

  // Create Categories & Items if empty
  const catCount = await prisma.category.count({ where: { restaurantId: restaurant.id } });
  if (catCount === 0) {
    const steamCat = await prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: "Steam Momo",
        description: "Freshly steamed dumplings served with tomato-sesame chutney",
      },
    });

    const cmomoCat = await prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: "Chilly Momo",
        description: "Tossed in spicy capsicum chili garlic gravy",
      },
    });

    const drinksCat = await prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: "Beverages",
        description: "Refreshing cold drinks & teas",
      },
    });

    // Steam Momo item with variants
    const momoItem = await prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: steamCat.id,
        name: "Steamed Momo",
        description: "Traditional Nepali dumplings",
        price: 180,
        ingredients: "Flour, Onion, Ginger, Garlic, Spices",
        hasSpicyOption: true,
        hasNoteOption: true,
      },
    });

    await prisma.menuItemVariant.createMany({
      data: [
        { menuItemId: momoItem.id, name: "Veg", price: 150 },
        { menuItemId: momoItem.id, name: "Chicken", price: 180 },
        { menuItemId: momoItem.id, name: "Buff", price: 170 },
      ],
    });

    // Chilly Momo item
    const cmomoItem = await prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: cmomoCat.id,
        name: "C-Momo Special",
        description: "Pan fried momo tossed in hot chili salsa",
        price: 220,
        ingredients: "Chili Sauce, Onion, Capsicum",
        hasSpicyOption: true,
        hasNoteOption: true,
      },
    });

    await prisma.menuItemVariant.createMany({
      data: [
        { menuItemId: cmomoItem.id, name: "Veg C-Momo", price: 190 },
        { menuItemId: cmomoItem.id, name: "Chicken C-Momo", price: 230 },
      ],
    });

    // Drink item
    await prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: drinksCat.id,
        name: "Fresh Lemon Soda",
        description: "Sweet and salted lemon soda",
        price: 90,
        hasSpicyOption: false,
        hasNoteOption: true,
      },
    });

    console.log("Seeded menu categories, items, and variants.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
