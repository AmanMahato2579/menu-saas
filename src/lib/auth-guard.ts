import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import type { AdminUser } from "@/types";

export async function requireAuth(): Promise<AdminUser> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user as unknown as AdminUser;
}

export async function requireSuperAdmin(): Promise<AdminUser> {
  const user = await requireAuth();
  if (user.role !== UserRole.SUPER_ADMIN) {
    redirect("/admin");
  }
  return user;
}

export async function requireRestaurantAdmin(): Promise<AdminUser> {
  const user = await requireAuth();
  if (user.role !== UserRole.RESTAURANT_ADMIN || !user.restaurantId) {
    redirect("/login");
  }
  return user;
}
