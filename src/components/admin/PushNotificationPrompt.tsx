"use client";

import * as React from "react";
import { BellPlus, X } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function subscribeToPush(vapidPublicKey: string) {
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = subscription.toJSON();
  await fetch("/api/admin/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
}

function pushIsSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

export default function PushNotificationPrompt() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [visible, setVisible] = React.useState(
    () => Boolean(vapidPublicKey) && pushIsSupported() && Notification.permission === "default"
  );
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!vapidPublicKey || !pushIsSupported()) return;
    if (Notification.permission === "granted") {
      // Already granted earlier (or on a previous device session) — keep the
      // subscription alive silently, no need to prompt again.
      subscribeToPush(vapidPublicKey).catch(() => {});
    }
  }, [vapidPublicKey]);

  const handleEnable = async () => {
    if (!vapidPublicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await subscribeToPush(vapidPublicKey);
      }
    } catch {
      // ignore — user can retry from the banner
    } finally {
      setBusy(false);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2.5 text-sm mb-4">
      <BellPlus className="w-4 h-4 text-orange-600 shrink-0" />
      <p className="text-orange-800 flex-1">
        Turn on notifications to hear about new orders even when this tab isn&apos;t open.
      </p>
      <button
        onClick={handleEnable}
        disabled={busy}
        className="text-orange-700 font-semibold hover:text-orange-800 whitespace-nowrap disabled:opacity-50"
      >
        {busy ? "Enabling…" : "Enable"}
      </button>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="text-orange-400 hover:text-orange-600 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
