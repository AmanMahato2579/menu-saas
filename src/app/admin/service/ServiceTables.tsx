"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { Clock3, Users } from "lucide-react";

interface TableSummary {
  id: string;
  tableNumber: number;
  isActive: boolean;
  tableSessions: {
    id: string;
    customerName: string | null;
    orders: { orderItems: { status: string }[] }[];
  }[];
}

export default function ServiceTables({
  tables,
  language,
}: {
  tables: TableSummary[];
  language: string;
}) {
  const lang = language;
  const activeTables = tables.filter((table) => table.isActive);

  // Free tables go last so staff scan occupied tables first.
  const sorted = [
    ...tables.filter((t) => t.tableSessions.length > 0),
    ...tables.filter((t) => t.tableSessions.length === 0),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {activeTables.filter((t) => t.tableSessions.length > 0).length} / {activeTables.length}{" "}
          {t(lang, "occupied", "प्रयोगमा")}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🪑</p>
          <p className="text-sm">
            {t(lang, "No tables yet — it's very quiet here", "अहिलेसम्म कुनै टेबल छैन")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {sorted.map((table) => {
            const session = table.tableSessions[0];
            const items = session?.orders.flatMap((o) => o.orderItems) ?? [];
            const newCount = items.filter((i) => i.status === "NEW").length;
            const preparingCount = items.filter((i) => i.status === "PREPARING").length;
            const servedCount = items.filter((i) => i.status === "SERVED").length;
            const occupied = !!session;

            return (
              <Link
                key={table.id}
                href={occupied ? `/admin/service/${table.id}` : `/admin/service/${table.id}`}
                className={`relative rounded-2xl border p-4 flex flex-col min-h-[120px] transition-all ${
                  occupied
                    ? "bg-white border-orange-200 shadow-sm hover:shadow-md hover:border-orange-400"
                    : table.isActive
                    ? "bg-white border-gray-200 hover:border-gray-300"
                    : "bg-gray-50 border-gray-100 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-black ${occupied ? "text-orange-600" : "text-gray-400"}`}>
                    #{table.tableNumber}
                  </span>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      occupied ? "bg-orange-500" : table.isActive ? "bg-gray-300" : "bg-gray-200"
                    }`}
                  />
                </div>

                {occupied ? (
                  <div className="mt-3 space-y-1.5">
                    {session.customerName && (
                      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                        <Users className="w-3 h-3 text-gray-400" /> {session.customerName}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                      {newCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">New {newCount}</span>
                      )}
                      {preparingCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">🔥 {preparingCount}</span>
                      )}
                      {servedCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ {servedCount}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-400 flex items-center gap-1">
                    <Clock3 className="w-3 h-3" />
                    {table.isActive
                      ? t(lang, "Free — start an order", "खाली — अर्डर सुरु गर्नुहोस्")
                      : t(lang, "Table disabled", "टेबल बन्द")}
                  </p>
                )}

                {occupied && (newCount > 0 || preparingCount > 0) && (
                  <span className="absolute top-3 right-3 w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
                )}
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6">
        {t(lang, "Tap a table to take an order, update serving progress, and checkout.", "अर्डर लिन, सेवा अद्यावधिक गर्न र बिल बनाउन टेबलमा ट्याप गर्नुहोस्।")}
      </p>
    </div>
  );
}