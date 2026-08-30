import { requireRestaurantAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import OffersClient from "./OffersClient";

export const metadata = { title: "Offers – MenuQR Admin" };
export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const user = await requireRestaurantAdmin();
  const offers = await prisma.specialOffer.findMany({
    where: { restaurantId: user.restaurantId! },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Special Offers</h1>
        <p className="text-gray-500 text-sm mt-1">
          Create promotions and deals shown to customers
        </p>
      </div>
      <OffersClient
        offers={JSON.parse(JSON.stringify(offers))}
        restaurantId={user.restaurantId!}
      />
    </div>
  );
}
