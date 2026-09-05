"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Bell, BellRing, CheckCheck, Loader2, PackageCheck, Table2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const POLL_INTERVAL = 3000;
const ATTENTION_TYPES = new Set(["NEW_TABLE_SESSION", "ASSISTANCE_REQUEST", "NEW_ORDER"]);

function playAttentionSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(660, context.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.7);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.72);
    oscillator.addEventListener("ended", () => context.close());
  } catch { /* Browsers may block sound until the owner interacts with the page. */ }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "NEW_ORDER") {
    return (
      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
        <PackageCheck className="w-4 h-4" />
      </div>
    );
  }
  if (type === "NEW_TABLE_SESSION") {
    return (
      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
        <Table2 className="w-4 h-4" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
      <RefreshCw className="w-4 h-4" />
    </div>
  );
}

export default function NotificationBell({ initialUnreadCount = 0 }: { initialUnreadCount?: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount);
  const [loading, setLoading] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);
  const [attentionNotification, setAttentionNotification] = React.useState<Notification | null>(null);
  const alertedIds = React.useRef(new Set<string>());
  const isFirstFetch = React.useRef(true);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications?limit=15");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      const urgent = data.notifications.find((notification: Notification) => !notification.read && ATTENTION_TYPES.has(notification.type));
      if (isFirstFetch.current) {
        data.notifications.forEach((notification: Notification) => alertedIds.current.add(notification.id));
        isFirstFetch.current = false;
      } else if (urgent && !alertedIds.current.has(urgent.id)) {
        alertedIds.current.add(urgent.id);
        setAttentionNotification(urgent);
        playAttentionSound();
      }
    } catch {
      // ignore transient errors
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const openDropdown = () => {
    setLoading(true);
    setOpen((prev) => !prev);
    fetchNotifications();
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch("/api/admin/notifications", { method: "PATCH" });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      fetch(`/api/admin/notifications/${n.id}`, { method: "PATCH" }).catch(() => {});
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const acceptAttention = async () => {
    if (!attentionNotification) return;
    const notification = attentionNotification;

    // Accept the pending order this alert refers to (orderId is embedded in the link)
    const orderId = notification.link
      ? new URLSearchParams(notification.link.split("?")[1] || "").get("orderId")
      : null;
    if (orderId) {
      await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACCEPTED" }),
      }).catch(() => {});
    }

    await fetch(`/api/admin/notifications/${notification.id}`, { method: "PATCH" });
    setUnreadCount((count) => Math.max(0, count - 1));
    setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    setAttentionNotification(null);
    if (notification.link) router.push(notification.link);
  };

  return (
    <>
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          onClick={openDropdown}
          className="relative w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Content
        align="end"
        sideOffset={8}
        className="z-50 w-[calc(100vw-2rem)] max-w-80 md:w-96 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            <p className="text-xs text-gray-500">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1 disabled:opacity-50"
            >
              {markingAll ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCheck className="w-3 h-3" />
              )}
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-600">No notifications yet</p>
              <p className="text-xs text-gray-400 mt-1">
                {"You'll"} be notified of new orders and table activity here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors",
                      !n.read && "bg-orange-50/50"
                    )}
                  >
                    <NotificationIcon type={n.type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{n.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-200 p-1.5">
          <Link
            href="/admin/notifications"
            onClick={() => setOpen(false)}
            className="block text-center py-2 rounded-lg text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors"
          >
            View all notifications
          </Link>
        </div>
      </Popover.Content>
    </Popover.Root>
    {attentionNotification && (
      <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-3xl border-4 border-orange-400 bg-white p-7 text-center shadow-2xl animate-in fade-in zoom-in-95">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600"><BellRing className="h-9 w-9 animate-pulse" /></div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Immediate attention required</p>
          <h2 className="mt-2 text-2xl font-extrabold text-gray-900">{attentionNotification.title}</h2>
          <p className="mt-3 text-lg text-gray-700">{attentionNotification.message}</p>
          <p className="mt-2 text-sm text-gray-500">Acknowledge this alert, then act on it now.</p>
          <button onClick={acceptAttention} className="mt-6 w-full rounded-xl bg-orange-500 px-5 py-4 text-base font-bold text-white hover:bg-orange-600">Accept & view details</button>
          <button onClick={() => setAttentionNotification(null)} aria-label="Minimize alert" className="mt-3 text-sm font-medium text-gray-500 hover:text-gray-700"><X className="mr-1 inline h-4 w-4" /> Minimize</button>
        </div>
      </div>
    )}
    </>
  );
}
