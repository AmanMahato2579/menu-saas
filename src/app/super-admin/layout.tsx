import { requireSuperAdmin } from "@/lib/auth-guard";
import Link from "next/link";
import AuthStateWatcher from "@/components/admin/AuthStateWatcher";
import { LayoutDashboard, Building2, BadgeCheck, Settings, ScrollText, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();

  const links = [
    { href: "/super-admin", label: "Overview", icon: LayoutDashboard, match: (p: string) => p === "/super-admin" },
    { href: "/super-admin/restaurants", label: "Restaurants", icon: Building2, match: (p: string) => p.startsWith("/super-admin/restaurants") },
    { href: "/super-admin/plans", label: "Plans", icon: BadgeCheck, match: (p: string) => p.startsWith("/super-admin/plans") },
    { href: "/super-admin/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/super-admin/settings") },
    { href: "/super-admin/activity", label: "Activity", icon: ScrollText, match: (p: string) => p.startsWith("/super-admin/activity") },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AuthStateWatcher />
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500 flex items-center justify-center">
              <BadgeCheck className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">MenuQR · Super Admin</span>
          </div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 text-gray-300 text-sm hover:border-red-500/40 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </form>
        </div>
      </header>
      <nav className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 overflow-x-auto">
          {links.map(({ href, label, icon: Icon, match }) => (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap px-3.5 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-t-lg flex items-center gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}