"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { AdminUser } from "@/types";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";

interface AdminShellProps {
  user: AdminUser;
  initialUnreadCount: number;
  children: React.ReactNode;
}

export default function AdminShell({ user, initialUnreadCount, children }: AdminShellProps) {
  const pathname = usePathname();
  const [openedForPath, setOpenedForPath] = useState<string | null>(null);
  const sidebarOpen = openedForPath === pathname;

  const closeSidebar = () => setOpenedForPath(null);
  const toggleSidebar = () =>
    setOpenedForPath((prev) => (prev === pathname ? null : pathname));

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-950/60 md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <AdminSidebar user={user} open={sidebarOpen} onNavigate={closeSidebar} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AdminHeader
          user={user}
          initialUnreadCount={initialUnreadCount}
          onMenuClick={toggleSidebar}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
