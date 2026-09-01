"use client";

import type { AdminUser } from "@/types";
import NotificationBell from "./NotificationBell";

interface AdminHeaderProps {
  user: AdminUser;
  initialUnreadCount?: number;
}

export default function AdminHeader({ user, initialUnreadCount = 0 }: AdminHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Welcome back, {user.name.split(" ")[0]}!
        </h2>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell initialUnreadCount={initialUnreadCount} />
        <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center text-white font-semibold text-sm shadow">
          {user.name.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
