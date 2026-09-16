import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n";
import { getAdminBookings, todayInRestaurantTz } from "@/lib/db";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import BookingsClient from "./BookingsClient";

export const metadata = { title: "Bookings – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireRestaurantAdmin();
  const { date } = await searchParams;
  const bookingDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date! : todayInRestaurantTz();

  const [restaurant, bookings, serviceCount] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: user.restaurantId! },
      select: { language: true, bookingsEnabled: true },
    }),
    getAdminBookings(user.restaurantId!, bookingDate),
    prisma.bookableService.count({ where: { restaurantId: user.restaurantId!, isActive: true } }),
  ]);

  const lang = restaurant?.language ?? "EN";

  if (!restaurant?.bookingsEnabled) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">{t(lang, "Bookings", "बुकिङहरू")}</h1>
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CalendarCheck className="w-7 h-7 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">{t(lang, "Booking feature is off", "बुकिङ सुविधा बन्द छ")}</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            {t(
              lang,
              "Ask your super-admin to enable the Booking feature, then manage your services from the Bookings menu.",
              "यो सुविधा सक्रिय गर्न सुपर-एडमिनसँग कुरा गर्नुहोस्, त्यसपछि बुकिङ मेनुबाट सेवाहरू व्यवस्थापन गर्नुहोस्।"
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t(lang, "Bookings", "बुकिङहरू")}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {t(lang, "Receive, confirm or decline customer requests", "ग्राहकका बुकिङ स्वीकार वा अस्वीकार गर्नुहोस्")}
          </p>
        </div>
        <Link
          href="/admin/bookings/services"
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
        >
          <CalendarCheck className="w-4 h-4" />
          {t(lang, "Manage services", "सेवाहरू व्यवस्थापन")}
        </Link>
      </div>

      {serviceCount === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">
            {t(
              lang,
              "No bookable services yet. Add rooms, pool or adventures first.",
              "बुक गर्न मिल्ने सेवाहरू छैनन्। पहिले कोठा, पोखरी वा साहसिक गतिविधि थप्नुहोस्।"
            )}
          </p>
          <Link href="/admin/bookings/services" className="inline-block mt-4 text-sm font-medium text-orange-600 hover:underline">
            {t(lang, "Add services →", "सेवा थप्नुहोस् →")}
          </Link>
        </div>
      ) : (
        <BookingsClient
          initialDate={bookingDate}
          initialBookings={JSON.parse(JSON.stringify(bookings))}
          language={lang}
        />
      )}
    </div>
  );
}