"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { t, orderStatusLabel } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";
import { Loader2, Phone, Users, Clock, StickyNote, Check, X, Trash2, CheckCheck, CalendarDays } from "lucide-react";

interface BookingService {
  name: string;
  type: string;
}

interface Booking {
  id: string;
  contactName: string;
  contactPhone: string;
  note: string | null;
  bookingDate: string;
  startMinutes: number;
  durationMinutes: number;
  guests: number;
  status: string;
  createdAt: string;
  service: BookingService;
}

interface Props {
  initialDate: string;
  initialBookings: Booking[];
  language?: string;
}

function timeLabel(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export default function BookingsClient({ initialDate, initialBookings, language = "EN" }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [date, setDate] = React.useState(initialDate);
  const [bookings, setBookings] = React.useState<Booking[]>(initialBookings);
  const [loading, setLoading] = React.useState(false);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/bookings?date=${date}`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          if (!cancelled) {
            setBookings(data);
            router.refresh();
          }
        })
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [date, router]);

  const changeStatus = async (booking: Booking, status: "ACCEPTED" | "REJECTED" | "CANCELLED" | "COMPLETED") => {
    setUpdatingId(booking.id);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast({ title: `Booking ${status.toLowerCase().replace("_", " ")}`, variant: "success" });
        setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status } : b)));
        router.refresh();
      } else {
        const err = await res.json();
        toast({ title: "Could not update booking", variant: "destructive", description: err.error });
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING: "bg-amber-100 text-amber-700",
      ACCEPTED: "bg-green-100 text-green-700",
      REJECTED: "bg-red-100 text-red-700",
      COMPLETED: "bg-blue-100 text-blue-700",
      CANCELLED: "bg-gray-200 text-gray-600",
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
        {orderStatusLabel(status, language)}
      </span>
    );
  };

  const totals = React.useMemo(() => {
    const now = new Date().getTime();
    const upcoming = bookings.filter(
      (b) => (b.status === "PENDING" || b.status === "ACCEPTED") && b.createdAt
    ).length;
    const pendingUpcoming = bookings.filter((b) => b.status === "PENDING").length;
    return { pendingUpcoming, upcoming };
  }, [bookings]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2">
          <CalendarDays className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm text-gray-700 focus:outline-none"
          />
        </div>
        <div className="text-sm text-gray-500">
          <span className="font-semibold text-amber-600">{totals.pendingUpcoming}</span> {t(language, "awaiting decision", "निर्णय पर्खंदै")} ·{" "}
          <span className="font-semibold text-gray-700">{totals.upcoming}</span> {t(language, "open", "खुला")}
        </div>
      </div>

      {loading && bookings.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-500">
          {t(language, "No bookings on this date", "यस मितिको कुनै बुकिङ छैन")}
        </div>
      ) : (
        <div className="grid gap-3">
          {bookings.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{b.contactName || t(language, "Guest", "पाहुना")}</p>
                    {statusBadge(b.status)}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {b.bookingDate} · {timeLabel(b.startMinutes)}–{timeLabel(b.startMinutes + b.durationMinutes)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {b.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => changeStatus(b, "ACCEPTED")}
                        disabled={updatingId === b.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium"
                      >
                        {updatingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {t(language, "Accept", "स्वीकार गर्नुहोस्")}
                      </button>
                      <button
                        onClick={() => changeStatus(b, "REJECTED")}
                        disabled={updatingId === b.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 text-xs font-medium"
                      >
                        {updatingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        {t(language, "Reject", "अस्वीकार गर्नुहोस्")}
                      </button>
                    </>
                  )}
                  {b.status === "ACCEPTED" && (
                    <button
                      onClick={() => changeStatus(b, "COMPLETED")}
                      disabled={updatingId === b.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 text-xs font-medium"
                    >
                      {updatingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                      {t(language, "Mark completed", "सम्पन्न चिन्ह लगाउनुहोस्")}
                    </button>
                  )}
                  {(b.status === "PENDING" || b.status === "ACCEPTED") && (
                    <button
                      onClick={() => changeStatus(b, "CANCELLED")}
                      disabled={updatingId === b.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 text-xs font-medium"
                    >
                      {updatingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      {t(language, "Cancel", "रद्द गर्नुहोस्")}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500/70" /> {b.service.name}
                </span>
                <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-gray-400" /> {b.guests} {t(language, "guests", "जना")}</span>
                <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-gray-400" /> {b.contactPhone}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-gray-400" /> {Math.round(b.durationMinutes / 60)}h</span>
              </div>
              {b.note && (
                <p className="flex items-start gap-1.5 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  <StickyNote className="w-4 h-4 text-gray-400 mt-0.5" /> {b.note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}