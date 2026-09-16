import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n";
import { getAdminBookableServices } from "@/lib/db";
import BookingServicesClient from "./BookingServicesClient";

export const metadata = { title: "Booking Services – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function BookingServicesPage() {
  const user = await requireRestaurantAdmin();
  const [restaurant, services] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: user.restaurantId! },
      select: { language: true, bookingsEnabled: true },
    }),
    getAdminBookableServices(user.restaurantId!),
  ]);
  const lang = restaurant?.language ?? "EN";

  if (!restaurant?.bookingsEnabled) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">{t(lang, "Booking Services", "बुकिङ सेवाहरू")}</h1>
        <p className="text-sm text-gray-500">{t(lang, "Booking feature is off. Ask your super-admin to enable it.", "बुकिङ सुविधा बन्द छ। सुपर-एडमिनसँग कुरा गर्नुहोस्।")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t(lang, "Booking Services", "बुकिङ सेवाहरू")}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {t(lang, "Rooms, pools, games and adventures customers can reserve", "ग्राहकले बुक गर्न सक्ने कोठा, पोखरी, खेल र साहसिक सेवाहरू")}
        </p>
      </div>
      <BookingServicesClient initialServices={JSON.parse(JSON.stringify(services))} language={lang} />
    </div>
  );
}