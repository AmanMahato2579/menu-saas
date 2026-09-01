"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Bell, CheckCheck, Loader2, PackageCheck, Table2, RefreshCw } from "lucide-react";
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

const POLL_INTERVAL = 5000;

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

  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications?limit=15");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore transient errors
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
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

  return (
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
        className="z-50 w-80 md:w-96 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden"
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
              </p>            </div>
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
  );
}
