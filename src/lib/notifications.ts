import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";
import { sendPushToRestaurant } from "@/lib/push";

interface CreateNotificationInput {
  restaurantId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      restaurantId: input.restaurantId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
    },
  });

  // Best-effort: a push failure should never break notification creation.
  sendPushToRestaurant(input.restaurantId, {
    title: input.title,
    message: input.message,
    link: input.link,
  }).catch(() => {});

  return notification;
}

export function getUnreadCount(restaurantId: string) {
  return prisma.notification.count({
    where: { restaurantId, read: false },
  });
}

export function getRecentNotifications(restaurantId: string, take = 10) {
  return prisma.notification.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
