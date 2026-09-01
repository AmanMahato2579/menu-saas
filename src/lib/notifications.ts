import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

interface CreateNotificationInput {
  restaurantId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      restaurantId: input.restaurantId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
    },
  });
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
