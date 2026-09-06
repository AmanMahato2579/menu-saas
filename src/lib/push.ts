import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@menuqr.app";

const isConfigured = Boolean(vapidPublicKey && vapidPrivateKey);

if (isConfigured) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey!, vapidPrivateKey!);
}

interface PushPayload {
  title: string;
  message: string;
  link?: string | null;
}

/** Pushes a notification to every device the restaurant's admins have enabled push on. */
export async function sendPushToRestaurant(restaurantId: string, payload: PushPayload) {
  if (!isConfigured) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { restaurantId } });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    message: payload.message,
    link: payload.link ?? "/admin/notifications",
  });

  const staleEndpoints: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404/410 mean the subscription no longer exists on the browser's push service.
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  if (staleEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: staleEndpoints } } });
  }
}
