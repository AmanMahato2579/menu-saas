import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { getDashboardStats, getRestaurantById } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { t } from "@/lib/i18n";
import Link from "next/link";
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
  const lang = restaurant?.language ?? "EN";
  const planLabel = plan === "GOLD" ? "🥇 GOLD" : plan === "SILVER" ? "🥈 SILVER" : plan === "BRONZE" ? "🥉 BRONZE" : "⭐ STAR";
  const planColor = plan === "GOLD" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : plan === "SILVER" ? "bg-gray-50 text-gray-600 border-gray-300" : plan === "BRONZE" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-purple-50 text-purple-700 border-purple-200";

  const statCards = [
    { label: t(lang, "Today's Orders", "आजका अर्डरहरू"), value: stats.todayOrders, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-50" },
    { label: t(lang, "Pending", "पेन्डिङ"), value: stats.pendingCount, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: t(lang, "Accepted", "स्वीकृत"), value: stats.acceptedCount, icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-50" },
    { label: t(lang, "Preparing", "तयारीमा"), value: stats.preparingCount, icon: ChefHat, color: "text-orange-600", bg: "bg-orange-50" },
    { label: t(lang, "Ready", "तयार"), value: stats.readyCount, icon: Package, color: "text-green-600", bg: "bg-green-50" },
    { label: t(lang, "Completed Today", "आज सम्पन्न"), value: stats.completedCount, icon: XCircle, color: "text-gray-600", bg: "bg-gray-50" },
    { label: t(lang, "Active Tables", "सक्रिय टेबलहरू"), value: stats.activeTables, icon: QrCode, color: "text-purple-600", bg: "bg-purple-50" },
    {
      label: t(lang, "Today's Sales", "आजको बिक्री"),
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
          <h1 className="text-2xl font-bold text-gray-900">{t(lang, "Dashboard", "ड्यासबोर्ड")}</h1>
          <p className="text-gray-500 text-sm mt-1">{t(lang, "Overview of your restaurant today", "आज तपाईंको रेस्टुरेन्टको अवलोकन")}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border ${planColor}`}>
          {planLabel}
          <span className="text-xs font-normal opacity-70">{t(lang, "Plan", "योजना")}</span>
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
            <CardTitle className="text-base text-orange-700">{t(lang, "Pending Orders", "पेन्डिङ अर्डरहरू")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold text-orange-600">{stats.pendingCount}</p>
            <p className="text-sm text-orange-500 mt-1">{t(lang, "orders waiting for your response", "जवाफको पर्खाइमा अर्डरहरू")}</p>
            <Link href="/admin/orders?status=PENDING" className="inline-block mt-3 text-sm font-medium text-orange-600 hover:underline">
              {t(lang, "View & Accept →", "हेर्नुहोस् र स्वीकार गर्नुहोस् →")}
            </Link>
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-blue-700">{t(lang, "In Progress", "प्रक्रियामा")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold text-blue-600">
              {stats.acceptedCount + stats.preparingCount}
            </p>
            <p className="text-sm text-blue-500 mt-1">{t(lang, "orders accepted or being prepared", "स्वीकृत वा तयारीमा रहेका अर्डरहरू")}</p>
            <Link href="/admin/orders?status=PREPARING" className="inline-block mt-3 text-sm font-medium text-blue-600 hover:underline">
              {t(lang, "View Kitchen →", "किचन हेर्नुहोस् →")}
            </Link>
          </CardContent>
        </Card>

        <Card className="border-green-100 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-700">{t(lang, "Ready to Serve", "सेवा गर्न तयार")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold text-green-600">{stats.readyCount}</p>
            <p className="text-sm text-green-500 mt-1">{t(lang, "orders ready to be served", "सेवा गर्न तयार अर्डरहरू")}</p>
            <Link href="/admin/orders?status=READY" className="inline-block mt-3 text-sm font-medium text-green-600 hover:underline">
              {t(lang, "View Ready →", "तयार हेर्नुहोस् →")}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
