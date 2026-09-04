"use client";

import type { AdminUser } from "@/types";
import { Menu } from "lucide-react";
import NotificationBell from "./NotificationBell";

interface AdminHeaderProps {
  user: AdminUser;
  initialUnreadCount?: number;
  onMenuClick?: () => void;
}

export default function AdminHeader({ user, initialUnreadCount = 0, onMenuClick }: AdminHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden shrink-0 w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
            Welcome back, {user.name.split(" ")[0]}!
          </h2>
          <p className="hidden sm:block text-sm text-gray-500">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <NotificationBell initialUnreadCount={initialUnreadCount} />
        <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center text-white font-semibold text-sm shadow shrink-0">
          {user.name.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
