"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Pencil, Trash2, BedDouble, Waves, Gamepad2, Mountain, Package, X, CalendarCheck } from "lucide-react";

interface BookableService {
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
  isActive: boolean;
  sortOrder: number;
  _count?: { bookings: number };
}

interface Props {
  initialServices: BookableService[];
  language?: string;
}

const TYPE_LABELS: Record<string, { en: string; nep: string }> = {
  ROOM: { en: "Room", nep: "कोठा" },
  POOL: { en: "Swimming Pool", nep: "पौडीपोखरी" },
  TABLE_GAME: { en: "Pool Table / Game", nep: "पूल टेबल / खेल" },
  ADVENTURE: { en: "Adventure", nep: "साहसिक" },
  OTHER: { en: "Other", nep: "अन्य" },
};

function typeLabel(type: string, language: string): string {
  const entry = TYPE_LABELS[type];
  return entry ? (language === "NEP" ? entry.nep : entry.en) : type;
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

function formatPrice(price: string | number): number {
  return Number(price);
}

export default function BookingServicesClient({ initialServices, language = "EN" }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [services, setServices] = React.useState<BookableService[]>(initialServices);
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const refresh = () => {
    fetch("/api/admin/booking-services")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setServices)
      .catch(() => {});
    router.refresh();
  };

  const submit = async (form: HTMLFormElement) => {
    setSaving(true);
    const body = Object.fromEntries(new FormData(form).entries());
    const payload = {
      name: String(body.name),
      type: String(body.type),
      description: body.description ? String(body.description) : null,
      price: Number(body.price),
      imageUrl: body.imageUrl ? String(body.imageUrl) : null,
      capacity: Number(body.capacity),
      venueCount: Number(body.venueCount),
      slotDurationMinutes: Number(body.slotDuration) * 60,
      openingMinutes: Number(body.openingHour) * 60,
      closingMinutes: Number(body.closingHour) * 60,
    };
    try {
      const res = await fetch("/api/admin/booking-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast({ title: typeLabel(payload.type, language) + " added", variant: "success" });
        setShowAdd(false);
        refresh();
      } else {
        const err = await res.json();
        toast({ title: "Could not add service", variant: "destructive", description: typeof err.error === "string" ? err.error : "Invalid data" });
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const update = async (id: string, form: HTMLFormElement) => {
    setSaving(true);
    const body = Object.fromEntries(new FormData(form).entries());
    const payload = {
      name: String(body.name),
      type: String(body.type),
      description: body.description ? String(body.description) : null,
      price: Number(body.price),
      imageUrl: body.imageUrl ? String(body.imageUrl) : null,
      capacity: Number(body.capacity),
      venueCount: Number(body.venueCount),
      slotDurationMinutes: Number(body.slotDuration) * 60,
      openingMinutes: Number(body.openingHour) * 60,
      closingMinutes: Number(body.closingHour) * 60,
      isActive: body.isActive === "on",
    };
    try {
      const res = await fetch(`/api/admin/booking-services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast({ title: "Service updated", variant: "success" });
        setEditingId(null);
        refresh();
      } else {
        const err = await res.json();
        toast({ title: "Could not update service", variant: "destructive", description: typeof err.error === "string" ? err.error : "Invalid data" });
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: BookableService) => {
    const res = await fetch(`/api/admin/booking-services/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    if (res.ok) {
      toast({ title: s.isActive ? "Service hidden" : "Service visible to customers", variant: "success" });
      refresh();
    } else {
      toast({ title: "Could not toggle service", variant: "destructive" });
    }
  };

  const remove = async (s: BookableService) => {
    setDeletingId(s.id);
    const res = await fetch(`/api/admin/booking-services/${s.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      toast({ title: "Service deleted", variant: "success" });
      refresh();
    } else {
      const err = await res.json();
      toast({ title: "Could not delete service", variant: "destructive", description: err.error });
    }
  };

  const fields = (s?: BookableService) => (
    <>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">{t(language, "Name *", "नाम *")}</label>
        <Input name="name" defaultValue={s?.name ?? ""} required placeholder={t(language, "e.g. Deluxe Room", "जस्तै: डिलक्स कोठा")} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">{t(language, "Type *", "प्रकार *")}</label>
        <select name="type" defaultValue={s?.type ?? "OTHER"} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
          {Object.keys(TYPE_LABELS).map((type) => (
            <option key={type} value={type}>{typeLabel(type, language)}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">{t(language, "Price (Rs.) *", "मूल्य (रु.) *")}</label>
        <Input name="price" type="number" min="0" step="0.01" defaultValue={s ? formatPrice(s.price) : ""} required />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">{t(language, "Capacity (guests)", "क्षमता (जना)")}</label>
        <Input name="capacity" type="number" min="1" max="500" defaultValue={s?.capacity ?? 2} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">{t(language, "How many available at once", "एकै पटक कति उपलब्ध")}</label>
        <Input name="venueCount" type="number" min="1" max="100" defaultValue={s?.venueCount ?? 1} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">{t(language, "Duration (hours) *", "अवधि (घण्टा) *")}</label>
        <Input name="slotDuration" type="number" min="1" max="24" defaultValue={Math.round((s?.slotDurationMinutes ?? 60) / 60)} required />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">{t(language, "Opening hour (0–24)", "खुल्ने समय (०-२४)")}</label>
        <Input name="openingHour" type="number" min="0" max="23" defaultValue={Math.floor((s?.openingMinutes ?? 480) / 60)} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">{t(language, "Closing hour (0–24)", "बन्द हुने समय (०-२४)")}</label>
        <Input name="closingHour" type="number" min="1" max="24" defaultValue={Math.ceil((s?.closingMinutes ?? 1380) / 60)} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">{t(language, "Image URL (optional)", "छवि लिंक (वैकल्पिक)")}</label>
        <Input name="imageUrl" type="url" defaultValue={s?.imageUrl ?? ""} placeholder="https://example.com/room.jpg" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label className="text-xs font-medium text-gray-500">{t(language, "Description", "विवरण")}</label>
        <Textarea name="description" rows={2} defaultValue={s?.description ?? ""} />
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      <div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
        >
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {t(language, showAdd ? "Cancel" : "Add service", showAdd ? "रद्द गर्नुहोस्" : "सेवा थप्नुहोस्")}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
          className="bg-white rounded-2xl border border-orange-200 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="sm:col-span-2 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-800">{t(language, "New bookable service", "नयाँ बुक हुने सेवा")}</h3>
          </div>
          {fields()}
          <div className="sm:col-span-2 flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t(language, "Add service", "सेवा थप्नुहोस्")}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm">{t(language, "Cancel", "रद्द गर्नुहोस्")}</button>
          </div>
        </form>
      )}

      {services.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-500">
          {t(language, "No services yet. Add your first bookable service above.", "अहिलेसम्म कुनै सेवा छैन। माथि पहिलो बुक हुने सेवा थप्नुहोस्।")}
        </div>
      ) : (
        <div className="grid gap-3">
          {services.map((s) => {
            const Icon = typeIcon(s.type);
            const editing = editingId === s.id;
            const canDelete = !s._count || s._count.bookings === 0;
            return (
              <div key={s.id} className={`bg-white rounded-2xl border p-5 ${editing ? "border-orange-200" : "border-gray-200"}`}>
                {editing ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      update(s.id, e.currentTarget);
                    }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  >
                    <div className="sm:col-span-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-800">{t(language, "Edit service", "सेवा सम्पादन")}</h3>
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input type="checkbox" name="isActive" defaultChecked={s.isActive} className="w-4 h-4 accent-orange-500" />
                        {t(language, "Visible to customers", "ग्राहकलाई देखिने")}
                      </label>
                    </div>
                    {fields(s)}
                    <div className="sm:col-span-2 flex gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                        {t(language, "Save changes", "परिवर्तन सुरक्षित गर्नुहोस्")}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm">{t(language, "Cancel", "रद्द गर्नुहोस्")}</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                      {s.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{s.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {typeLabel(s.type, language)}
                        </span>
                        {!s.isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{t(language, "hidden", "लुकाइएको")}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        <span className="font-semibold text-gray-700">Rs. {formatPrice(s.price).toFixed(2)}</span>
                        {" · "}
                        {s.capacity} {t(language, "guests", "जना")} · {s.venueCount} {t(language, "available", "उपलब्ध")} · {Math.round(s.slotDurationMinutes / 60)}h slot
                        {(s._count?.bookings ?? 0) > 0 && <> · {s._count!.bookings} {t(language, "bookings", "बुकिङ")}</>}
                      </p>
                      {s.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{s.description}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={() => setEditingId(s.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
                        <Pencil className="w-3.5 h-3.5" /> {t(language, "Edit", "सम्पादन")}
                      </button>
                      <button onClick={() => toggleActive(s)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
                        {s.isActive ? t(language, "Hide", "लुकाउनुहोस्") : t(language, "Show", "देखाउनुहोस्")}
                      </button>
                      <button
                        onClick={() => remove(s)}
                        disabled={!canDelete || deletingId === s.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40"
                        title={canDelete ? undefined : t(language, "Deactivate this service instead", "यसको सट्टा सेवा बन्द गर्नुहोस्")}
                      >
                        {deletingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        {t(language, "Delete", "मेट्नुहोस्")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}