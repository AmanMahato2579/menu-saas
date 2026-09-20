import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface ActivityInput {
  restaurantId?: string | null;
  restaurantName?: string | null;
  detail?: string | null;
}

const ACTIONS: Record<string, string> = {
  restaurant_created: "Restaurant created",
  restaurant_updated: "Restaurant updated",
  restaurant_activated: "Restaurant activated",
  restaurant_deactivated: "Restaurant deactivated",
  restaurant_deleted: "Restaurant deleted",
  subscription_changed: "Subscription changed",
  plan_changed: "Plan changed",
  star_assigned: "Star status assigned",
  star_removed: "Star status removed",
  feature_changed: "Feature access changed",
  limit_changed: "Table limit changed",
  bookings_enabled: "Bookings enabled",
  bookings_disabled: "Bookings disabled",
  password_reset: "Owner password reset",
  plan_updated: "Plan configuration updated",
  settings_updated: "Platform settings updated",
  subscription_auto_off: "Subscription auto-off triggered",
};

export function actionLabel(action: string): string {
  return ACTIONS[action] ?? action;
}

/** Record an important Super Admin action in the lightweight audit trail. */
export async function logActivity(action: string, input?: ActivityInput) {
  try {
    const session = await auth();
    const actorEmail = (session?.user as { email?: string } | undefined)?.email ?? null;
    await prisma.adminActivity.create({
      data: {
        action,
        restaurantId: input?.restaurantId ?? null,
        restaurantName: input?.restaurantName ?? null,
        detail: input?.detail ?? null,
        actorEmail,
      },
    });
  } catch (error) {
    // Audit trail must never break the primary action.
    console.error("[activity-log] failed to record:", error);
  }
}

export async function listActivity({ limit = 60 }: { limit?: number } = {}) {
  return prisma.adminActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}