import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { getDashboardStats, getRestaurantById } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ClipboardList,
  Clock,
  CheckCircle,
  ChefHat,
  Package,
  XCircle,
  QrCode,
  TrendingUp,
} from "lucide-react";

export const metadata = { title: "Dashboard – MenuQR Admin" };

export default async function AdminDashboard() {
  const user = await requireRestaurantAdmin();
  const [stats, restaurant] = await Promise.all([
    getDashboardStats(user.restaurantId!),
    getRestaurantById(user.restaurantId!),
  ]);

  const plan = restaurant?.plan ?? "STAR";
  const planLabel = plan === "GOLD" ? "🥇 GOLD" : plan === "SILVER" ? "🥈 SILVER" : plan === "BRONZE" ? "🥉 BRONZE" : "⭐ STAR";
  const planColor = plan === "GOLD" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : plan === "SILVER" ? "bg-gray-50 text-gray-600 border-gray-300" : plan === "BRONZE" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-purple-50 text-purple-700 border-purple-200";

  const statCards = [
    { label: "Today's Orders", value: stats.todayOrders, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pending", value: stats.pendingCount, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Accepted", value: stats.acceptedCount, icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Preparing", value: stats.preparingCount, icon: ChefHat, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Ready", value: stats.readyCount, icon: Package, color: "text-green-600", bg: "bg-green-50" },
    { label: "Completed Today", value: stats.completedCount, icon: XCircle, color: "text-gray-600", bg: "bg-gray-50" },
    { label: "Active Tables", value: stats.activeTables, icon: QrCode, color: "text-purple-600", bg: "bg-purple-50" },
    {
      label: "Today's Sales",
      value: formatCurrency(Number(stats.todaySales)),
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
      isText: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of your restaurant today</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border ${planColor}`}>
          {planLabel}
          <span className="text-xs font-normal opacity-70">Plan</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg, isText }) => (
          <Card key={label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">{label}</p>
                  <p className={`text-3xl font-bold mt-1 ${color}`}>
                    {isText ? value : value}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-orange-700">Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold text-orange-600">{stats.pendingCount}</p>
            <p className="text-sm text-orange-500 mt-1">orders waiting for your response</p>
            <a href="/admin/orders?status=PENDING" className="inline-block mt-3 text-sm font-medium text-orange-600 hover:underline">
              View & Accept →
            </a>
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-blue-700">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold text-blue-600">
              {stats.acceptedCount + stats.preparingCount}
            </p>
            <p className="text-sm text-blue-500 mt-1">orders accepted or being prepared</p>
            <a href="/admin/orders?status=PREPARING" className="inline-block mt-3 text-sm font-medium text-blue-600 hover:underline">
              View Kitchen →
            </a>
          </CardContent>
        </Card>

        <Card className="border-green-100 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-700">Ready to Serve</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold text-green-600">{stats.readyCount}</p>
            <p className="text-sm text-green-500 mt-1">orders ready to be served</p>
            <a href="/admin/orders?status=READY" className="inline-block mt-3 text-sm font-medium text-green-600 hover:underline">
              View Ready →
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
