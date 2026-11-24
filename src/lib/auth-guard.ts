import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import type { AdminUser } from "@/types";
import { loadOperationalRestaurant, isRestaurantOperational } from "@/lib/plans";

export async function requireAuth(): Promise<AdminUser> {
  const session = await auth();
  const user = session?.user as (AdminUser | undefined);
  if (!user?.id || !user?.role) {
    // Session exists but was revoked/wiped (e.g. tokenVersion mismatch) — force
    // sign-out so the edge proxy doesn't bounce /login back to the dashboard.
    if (session?.user) {
      redirect("/login?signout=1");
    }
    redirect("/login");
  }
  return user;
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
  
  const restaurant = await loadOperationalRestaurant(user.restaurantId!);
  if (!restaurant || !isRestaurantOperational(restaurant)) {
    redirect("/inactive");
  }
  
  return user;
}
