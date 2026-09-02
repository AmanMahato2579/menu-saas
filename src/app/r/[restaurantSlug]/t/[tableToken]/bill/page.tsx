import { notFound, redirect } from "next/navigation";
import { getRestaurantBySlug, getTableByToken, getActiveSession, getSessionBill } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Receipt, CreditCard } from "lucide-react";

interface Props {
  params: Promise<{ restaurantSlug: string; tableToken: string }>;
}

export const dynamic = "force-dynamic";

export default async function BillPage({ params }: Props) {
  const { restaurantSlug, tableToken } = await params;
  const restaurant = await getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();
  const table = await getTableByToken(tableToken);
  if (!table || table.restaurantId !== restaurant.id) notFound();
  const session = await getActiveSession(table.id, restaurant.id);
  if (!session) redirect(`/r/${restaurantSlug}/t/${tableToken}`);
  const { orders, subtotal, taxAmount, serviceChargeAmount, total } = await getSessionBill(session.id, restaurant.id);

  const baseUrl = `/r/${restaurantSlug}/t/${tableToken}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={baseUrl}>
            <button className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-orange-500" /> Your Bill
            </h1>
            <p className="text-xs text-gray-400">Table {table.tableNumber} · {restaurant.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Restaurant Header */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border text-center">
          {restaurant.logoUrl && (
            <img src={restaurant.logoUrl} alt="" className="w-14 h-14 rounded-2xl mx-auto mb-2 object-cover" />
          )}
          <h2 className="font-bold text-gray-900 text-lg">{restaurant.name}</h2>
          <p className="text-gray-400 text-sm">Table {table.tableNumber}</p>
          <div className="w-full border-t border-dashed my-3" />
          <p className="text-xs text-gray-400 uppercase tracking-wider">Bill / Receipt</p>
        </div>

        {/* Orders & Items */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border">
            <p className="text-gray-400">No orders yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            {orders.map((order, orderIdx) => (
              <div key={order.id} className="border-b last:border-b-0">
                <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500">Order #{order.orderNumber}</p>
                </div>
                {order.orderItems.map((item) => (
                  <div key={item.id} className="flex items-start justify-between px-4 py-2.5 text-sm">
                    <div className="flex-1">
                      <span className="text-gray-800">{item.menuItemName}</span>
                      {item.isSpicy && <span className="text-red-400 ml-1 text-xs">🌶️</span>}
                      <span className="text-gray-400 ml-1">× {item.quantity}</span>
                    </div>
                    <span className="font-medium text-gray-700">
                      {formatCurrency(Number(item.subtotal), restaurant.currency)}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            {/* Subtotal & Tax */}
            <div className="px-4 py-3 border-t">
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, restaurant.currency)}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Tax ({restaurant.taxRate?.toString() || 0}%)</span>
                  <span>{formatCurrency(taxAmount, restaurant.currency)}</span>
                </div>
              )}
              {serviceChargeAmount > 0 && <div className="flex justify-between text-sm text-gray-500"><span>Service charge ({restaurant.serviceChargeRate?.toString() || 0}%)</span><span>{formatCurrency(serviceChargeAmount, restaurant.currency)}</span></div>}
            </div>

            {/* Total */}
            <div className="px-4 py-4 border-t-2 border-dashed flex justify-between items-center">
              <span className="font-bold text-gray-900 text-lg">Total</span>
              <span className="font-extrabold text-2xl text-orange-600">
                {formatCurrency(total, restaurant.currency)}
              </span>
            </div>
          </div>
        )}

        {/* Payment Notice */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CreditCard className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-bold text-green-800 text-base">Pay at the Counter</h3>
          <p className="text-green-600 text-sm mt-1">
            Please settle your bill at the restaurant counter. We do not accept online payments.
          </p>
        </div>

        <Link
          href={baseUrl}
          className="block bg-orange-500 text-white rounded-2xl p-4 text-center font-bold hover:bg-orange-600 transition-colors"
        >
          ← Back to Menu
        </Link>
      </div>
    </div>
  );
}
