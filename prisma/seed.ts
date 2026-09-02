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
  } else {
    console.log(`Super Admin already exists: ${superAdminEmail}`);
  }

  const restaurantAdminEmail = "owner@demo.com";
  const existingRestaurant = await prisma.restaurant.findUnique({
    where: { slug: "demo-restaurant" },
  });

  if (!existingRestaurant) {
    const restaurant = await prisma.restaurant.create({
      data: {
        name: "Demo Restaurant",
        slug: "demo-restaurant",
        description: "A demo restaurant for testing",
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: restaurantAdminEmail,
        name: "Demo Owner",
        passwordHash: await bcrypt.hash("Owner123!", 10),
        role: "RESTAURANT_ADMIN",
        restaurantId: restaurant.id,
      },
    });

    // Create some tables for the demo restaurant
    await prisma.table.createMany({
      data: Array.from({ length: 5 }).map((_, i) => ({
        restaurantId: restaurant.id,
        tableNumber: i + 1,
        qrToken: `demo-table-${i + 1}`,
      })),
    });

    console.log(`Created Demo Restaurant Owner: ${restaurantAdminEmail} / Owner123!`);
  } else {
    console.log(`Demo Restaurant already exists.`);
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
