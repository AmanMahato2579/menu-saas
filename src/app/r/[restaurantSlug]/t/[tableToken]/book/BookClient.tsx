"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { t, orderStatusLabel } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";
import { useCustomerLanguage, LanguageToggle } from "@/hooks/use-customer-lang";
import { ArrowLeft, BedDouble, Waves, Gamepad2, Mountain, Package, Loader2, CalendarDays, Users, Phone, StickyNote, CheckCircle2, History } from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  language?: string;
}

interface Service {
  id: string;
  name: string;
  type: "ROOM" | "POOL" | "TABLE_GAME" | "ADVENTURE" | "OTHER";
  description: string | null;
  price: string;
  imageUrl: string | null;
  capacity: number;
  venueCount: number;
  slotDurationMinutes: number;
  openingMinutes: number;
  closingMinutes: number;
}

interface Slot {
  startMinutes: number;
  endMinutes: number;
  startLabel: string;
  endLabel: string;
}

interface MyBooking {
  id: string;
  contactName: string;
  contactPhone: string;
  bookingDate: string;
  startMinutes: number;
  durationMinutes: number;
  guests: number;
  status: string;
  service: { name: string; type: string };
}

interface Props {
  restaurant: Restaurant;
  tableToken: string;
  sessionId: string | null;
  services: Service[];
  enabled: boolean;
}

function typeIcon(type: string) {
  switch (type) {
    case "ROOM": return BedDouble;
    case "POOL": return Waves;
    case "TABLE_GAME": return Gamepad2;
    case "ADVENTURE": return Mountain;
    default: return Package;
  }
}

function timeLabel(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export default function BookClient({ restaurant, tableToken, sessionId, services, enabled }: Props) {
  const params = useParams();
  const { toast } = useToast();
  const [lang, setLang] = useCustomerLanguage(restaurant.id, restaurant.language ?? "EN");
  const baseUrl = `/r/${params.restaurantSlug}/t/${params.tableToken}`;

  const [selected, setSelected] = React.useState<Service | null>(null);
  const [date, setDate] = React.useState(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  });
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = React.useState(false);
  const [chosenSlot, setChosenSlot] = React.useState<Slot | null>(null);
  const [guests, setGuests] = React.useState(2);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [created, setCreated] = React.useState<string | null>(null);

  const [myBookings, setMyBookings] = React.useState<MyBooking[]>([]);
  const [phoneShown, setPhoneShown] = React.useState("");
  const [searching, setSearching] = React.useState(false);

  const loadSlots = React.useCallback(async (serviceId: string, forDate: string) => {
    setSlotsLoading(true);
    setChosenSlot(null);
    try {
      const res = await fetch(`/api/customer/bookings/availability?token=${tableToken}&serviceId=${serviceId}&date=${forDate}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
      toast({ title: t(lang, "Could not load slots", "स्लट लोड गर्न सकिएन"), variant: "destructive" });
    } finally {
      setSlotsLoading(false);
    }
  }, [tableToken, lang, toast]);

  const selectService = (s: Service) => {
    setSelected(s);
    setGuests(Math.min(2, s.capacity));
    loadSlots(s.id, date);
  };

  React.useEffect(() => {
    if (!selected) return;
    const timer = setTimeout(() => {
      loadSlots(selected.id, date);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selected]);

  const submitBooking = async () => {
    if (!selected || !chosenSlot || !name.trim() || !phone.trim()) {
      toast({ title: t(lang, "Fill in name, phone and a time slot", "नाम, फोन र समय छान्नुहोस्"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/customer/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tableToken,
          serviceId: selected.id,
          bookingDate: date,
          startMinutes: chosenSlot.startMinutes,
          durationMinutes: selected.slotDurationMinutes,
          contactName: name.trim(),
          contactPhone: phone.trim(),
          guests,
          note: note.trim() || undefined,
          sessionId: sessionId ?? undefined,
        }),
      });
      if (res.ok) {
        const body = await res.json();
        setCreated(body.id);
        toast({ title: t(lang, "Booking requested!", "बुकिङ अनुरोध भयो!"), variant: "success", description: t(lang, "The restaurant will confirm shortly.", "रेस्टुरेन्टले चाँडै पुष्टि गर्नेछ।") });
      } else {
        const err = await res.json();
        toast({ title: t(lang, "Could not book", "बुक गर्न सकिएन"), variant: "destructive", description: err.error });
      }
    } catch {
      toast({ title: t(lang, "Something went wrong", "केही गलत भयो"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const searchBookings = async () => {
    if (!phone.trim()) return;
    setSearching(true);
    setPhoneShown(phone.trim());
    try {
      const res = await fetch(`/api/customer/bookings?token=${tableToken}&phone=${encodeURIComponent(phone.trim())}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setMyBookings(await res.json());
    } catch {
      toast({ title: t(lang, "Could not load your bookings", "तपाईंका बुकिङहरू लोड गर्न सकिएन"), variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  if (!enabled) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6 text-center">
        <Package className="w-12 h-12 text-orange-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">{t(lang, "Bookings unavailable", "बुकिङ उपलब्ध छैन")}</h1>
        <p className="text-gray-500 mt-2 max-w-sm">{t(lang, "This restaurant does not offer online bookings right now.", "यो रेस्टुरेन्टले अहिले अनलाइन बुकिङ सुविधा दिँदैन।")}</p>
        <Link href={baseUrl} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> {t(lang, "Back to menu", "मेनुमा फर्कनुहोस्")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href={baseUrl} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 truncate">{t(lang, "Book Services", "सेवा बुक गर्नुहोस्")}</p>
          <p className="text-xs text-gray-500 truncate">{restaurant.name}</p>
        </div>
        <LanguageToggle lang={lang} onChange={() => setLang(lang === "EN" ? "NEP" : "EN")} />
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-6">
        {/* Confirmation banner */}
        {created && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">{t(lang, "Booking requested!", "बुकिङ अनुरोध भयो!")}</p>
              <p className="text-sm text-green-700 mt-0.5">
                #{created.slice(-6).toUpperCase()} · {t(lang, "Pending confirmation. Pay at the counter.", "पुष्टि हुन बाँकी। काउन्टरमा भुक्तानी गर्नुहोस्।")}
              </p>
            </div>
          </div>
        )}

        {/* Service list */}
        {!selected ? (
          <>
            {services.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-500">
                {t(lang, "No bookable services available right now.", "अहिले कुनै बुक हुने सेवा उपलब्ध छैन।")}
              </div>
            ) : (
              <div className="grid gap-3">
                {services.map((s) => {
                  const Icon = typeIcon(s.type);
                  return (
                    <button
                      key={s.id}
                      onClick={() => selectService(s)}
                      className="text-left bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 hover:border-orange-300 hover:shadow-sm transition-all"
                    >
                      <div className="w-14 h-14 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 overflow-hidden">
                        {s.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" />
                        ) : (
                          <Icon className="w-6 h-6" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {t(lang, `${s.capacity} guests`, `${s.capacity} जना`)} · {Math.round(s.slotDurationMinutes / 60)}h
                          {s.venueCount > 1 && ` · ${s.venueCount} ${t(lang, "available", "उपलब्ध")}`}
                        </p>
                        {s.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{s.description}</p>}
                      </div>
                      <span className="font-bold text-orange-600">{restaurant.currency} {Number(s.price).toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Booking form */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <p className="font-semibold text-gray-900">{selected.name}</p>
                    <p className="text-xs text-gray-500">
                      {restaurant.currency} {Number(selected.price).toFixed(2)} · {Math.round(selected.slotDurationMinutes / 60)}h
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${selected.type === "ROOM" ? "bg-indigo-100 text-indigo-700" : "bg-orange-100 text-orange-600"}`}>
                  {selected.type === "ROOM" ? t(lang, "Stays", "बसाइ") : t(lang, "Time slot", "समय स्लट")}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {t(lang, "Date", "मिति")}</label>
                <input
                  type="date"
                  min={date}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">{t(lang, "Available time", "उपलब्ध समय")}</label>
                {slotsLoading ? (
                  <div className="flex items-center justify-center py-6 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-gray-400 bg-gray-50 rounded-lg px-3 py-4 text-center">{t(lang, "No slots free on this date", "यस मितिमा कुनै समय खाली छैन")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => (
                      <button
                        key={s.startMinutes}
                        onClick={() => setChosenSlot(s)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          chosenSlot?.startMinutes === s.startMinutes
                            ? "bg-orange-500 text-white border-orange-500"
                            : "border-gray-200 text-gray-600 hover:border-orange-300"
                        }`}
                      >
                        {s.startLabel}–{s.endLabel}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {t(lang, "Guests", "जना")}</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setGuests((g) => Math.max(1, g - 1))} className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 font-bold">−</button>
                  <span className="w-10 text-center font-bold text-gray-800">{guests}</span>
                  <button onClick={() => setGuests((g) => Math.min(selected.capacity, g + 1))} className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 font-bold">+</button>
                  <span className="text-xs text-gray-400">{t(lang, `max ${selected.capacity}`, `धेरैमा ${selected.capacity}`)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500">{t(lang, "Your name *", "तपाईंको नाम *")}</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={t(lang, "Name", "नाम")} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {t(lang, "Phone *", "फोन *")}</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="98xxxxxxxx" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5" /> {t(lang, "Note (optional)", "टिप्पणी (वैकल्पिक)")}</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <button
                onClick={submitBooking}
                disabled={submitting || !chosenSlot}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarDays className="w-5 h-5" />}
                {t(lang, `Request booking · ${restaurant.currency} ${Number(selected.price).toFixed(2)}`, `बुकिङ अनुरोध · ${restaurant.currency} ${Number(selected.price).toFixed(2)}`)}
              </button>
              <p className="text-xs text-gray-400 text-center">{t(lang, "Pay at the counter when you arrive.", "आउँदा काउन्टरमा भुक्तानी गर्नुहोस्।")}</p>
            </div>
          </>
        )}

        {/* My bookings */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900 mb-3">
            <History className="w-4 h-4 text-orange-500" /> {t(lang, "My Bookings", "मेरा बुकिङहरू")}
          </h2>
          <div className="flex gap-2 mb-4">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              placeholder={t(lang, "Enter the phone you booked with", "बुक गर्दा प्रयोग गरेको फोन लेख्नुहोस्")}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-0"
            />
            <button
              onClick={searchBookings}
              disabled={searching || !phone.trim()}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
              {t(lang, "Find", "खोज्नुहोस्")}
            </button>
          </div>

          {phoneShown && (
            <div className="space-y-2">
              {myBookings.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">{t(lang, "No bookings found for this phone.", "यस फोनको कुनै बुकिङ फेला परेन।")}</p>
              ) : (
                myBookings.map((b) => {
                  const Icon = typeIcon(b.service.type);
                  const statusMap: Record<string, string> = {
                    PENDING: "bg-amber-100 text-amber-700",
                    ACCEPTED: "bg-green-100 text-green-700",
                    REJECTED: "bg-red-100 text-red-700",
                    COMPLETED: "bg-blue-100 text-blue-700",
                    CANCELLED: "bg-gray-200 text-gray-600",
                  };
                  return (
                    <div key={b.id} className="border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-gray-800 text-sm truncate">{b.service.name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusMap[b.status] ?? "bg-gray-100"}`}>
                            {orderStatusLabel(b.status, lang)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{b.bookingDate} · {timeLabel(b.startMinutes)}–{timeLabel(b.startMinutes + b.durationMinutes)} · {b.guests} {t(lang, "guests", "जना")}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <p className="text-xs text-center text-gray-400 pt-1">{t(lang, "We may call to confirm.", "हामी पुष्टि गर्न फोन गर्न सक्छौं।")}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}