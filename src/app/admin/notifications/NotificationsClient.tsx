"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageCheck, Table2, CheckCheck, RefreshCw, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface Props {
  notifications: Notification[];
  unreadCount: number;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " · " + date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "NEW_ORDER") {
    return (
      <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
        <PackageCheck className="w-5 h-5" />
      </div>
    );
  }
  if (type === "NEW_TABLE_SESSION") {
    return (
      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
        <Table2 className="w-5 h-5" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
      <RefreshCw className="w-5 h-5" />
    </div>
  );
}

export default function NotificationsClient({ notifications, unreadCount: initialUnread }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(notifications);
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const [markingAll, setMarkingAll] = useState(false);

  const markOneRead = async (n: Notification) => {
    if (n.read) return;
    fetch(`/api/admin/notifications/${n.id}`, { method: "PATCH" }).catch(() => {});
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
    if (n.link) router.push(n.link);
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch("/api/admin/notifications", { method: "PATCH" });
      setItems((prev) => prev.map((x) => (x.read ? x : { ...x, read: true })));
      setUnreadCount(0);
      router.refresh();
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={markAllRead}
            disabled={markingAll}
            className="h-9"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
            <Bell className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-lg font-medium text-gray-500 mt-4">No notifications</p>
          <p className="text-sm mt-1">
            Notifications about new orders and table activity will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {items.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-4 p-4",
                !n.read && "bg-orange-50/50"
              )}
            >
              <NotificationIcon type={n.type} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(n.createdAt)}</p>
              </div>
              {n.link && (
                <Link
                  href={n.link}
                  onClick={() => markOneRead(n)}
                  className="text-xs font-medium text-orange-600 hover:text-orange-700 mt-1 shrink-0"
                >
                  View
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
