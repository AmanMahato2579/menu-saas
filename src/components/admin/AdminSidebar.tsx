"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { AdminUser } from "@/types";
import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  QrCode,
  Settings,
  LogOut,
  ChefHat,
  Bell,
} from "lucide-react";
import InstallPWA from "./InstallPWA";

interface AdminSidebarProps {
  user: AdminUser;
  /** Whether the drawer is open on mobile. Ignored at md+ where the sidebar is always visible. */
  open?: boolean;
  /** Called when a nav link is clicked, so the mobile drawer can close itself. */
  onNavigate?: () => void;
}

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/tables", label: "Tables", icon: QrCode },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminSidebar({ user, open = false, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "admin-sidebar w-72 sm:w-64 flex flex-col shrink-0 text-white",
        "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out",
        "md:static md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shrink-0">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">MenuQR</div>
            <div className="text-xs text-white/50 leading-tight">Admin Panel</div>
          </div>
        </div>
      </div>

      {user.restaurantName && (
        <div className="px-6 py-3 border-b border-white/10">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Restaurant</p>
          <p className="text-sm font-medium text-white/80 truncate">{user.restaurantName}</p>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <InstallPWA />

      <div className="p-4 border-t border-white/10">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs font-medium text-white/70 truncate">{user.name}</p>
          <p className="text-xs text-white/40 truncate">{user.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-red-500/20 transition-all"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
