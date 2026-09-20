"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/components/ui/toast";
import { Plus, Building2, Users, QrCode, CheckCircle, XCircle, Loader2, Trash2, Pencil, CalendarCheck, Star, Clock3 } from "lucide-react";
import { slugify } from "@/lib/utils";
import { planStyleVariant } from "@/lib/plan-catalog";
import { BRAND_PALETTES } from "@/lib/brand";

const restaurantSchema = z.object({
  name: z.string().min(2, "Name too short"),
  ownerName: z.string().min(1, "Required"),
  ownerEmail: z.string().email("Invalid email"),
  tempPassword: z.string().min(6, "Min 6 chars"),
  tableCount: z.coerce.number().int().min(0).max(200),
  phone: z.string().optional(),
  address: z.string().optional(),
  plan: z.enum(["STAR", "SILVER", "BRONZE"]).optional(),
  starNumber: z.coerce.number().int().min(1).max(10).optional().nullable(),
});

type RestaurantForm = z.infer<typeof restaurantSchema>;

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  tableLimit: number;
  isActive: boolean;
  plan: string;
  bookingsEnabled: boolean;
  brandColor: string;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: string | null;
  neverExpires: boolean;
  autoOff: boolean;
  starNumber: number | null;
  starNote: string | null;
  createdAt: string;
  _count: { tables: number; users: number };
}

interface Props {
  restaurants: Restaurant[];
}

const inputCls = "w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500";

function subscriptionInfo(r: Restaurant): { label: string; className: string } {
  if (!r.isActive) return { label: "Inactive", className: "bg-red-500/20 text-red-400" };
  if (r.neverExpires) return { label: "Never expires", className: "bg-green-500/20 text-green-400" };
  if (r.subscriptionExpiresAt) {
    const days = Math.ceil((new Date(r.subscriptionExpiresAt).getTime() - Date.now()) / 86400000);
    if (days < 0) return { label: `Expired ${Math.abs(days)}d ago · auto-off ${r.autoOff ? "ON" : "OFF"}`, className: "bg-red-500/20 text-red-400" };
    if (days <= 14) return { label: `${days} days left`, className: "bg-amber-500/20 text-amber-300" };
    return { label: `${days} days left`, className: "bg-green-500/20 text-green-400" };
  }
  return { label: r.subscriptionStatus ?? "ACTIVE", className: "bg-white/10 text-gray-300" };
}

export default function SuperAdminClient({ restaurants }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<RestaurantForm>({
      resolver: zodResolver(restaurantSchema) as unknown as Resolver<RestaurantForm>,
      defaultValues: { tableCount: 0, plan: "STAR", starNumber: null },
    });

  const name = watch("name");

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/super-admin/restaurants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res;
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const res = await patch(id, { isActive: !current });
    if (res.ok) {
      toast({ title: current ? "Restaurant deactivated" : "Restaurant activated", variant: "success" });
      startTransition(() => router.refresh());
    } else {
      const err = await res.json();
      toast({ title: "Error updating status", variant: "destructive", description: JSON.stringify(err.error) });
    }
  };

  const toggleBookings = async (id: string, current: boolean) => {
    const res = await patch(id, { bookingsEnabled: !current });
    if (res.ok) {
      toast({ title: `Bookings ${!current ? "enabled" : "disabled"}`, variant: "success" });
      startTransition(() => router.refresh());
    } else {
      const err = await res.json();
      toast({ title: "Error updating bookings", variant: "destructive", description: JSON.stringify(err.error) });
    }
  };

  const extendDays = async (id: string, days: number) => {
    const res = await patch(id, { extendDays: days });
    toast(
      res.ok
        ? { title: `Subscription extended by ${days} days`, variant: "success" }
        : { title: "Could not extend subscription", variant: "destructive" }
    );
    if (res.ok) startTransition(() => router.refresh());
  };

  const assignNextStar = async (r: Restaurant) => {
    const used = new Set(restaurants.map((x) => x.starNumber).filter((n): n is number => n != null));
    for (let n = 1; n <= 10; n++) {
      if (!used.has(n)) {
        const res = await patch(r.id, { starNumber: n });
        toast(
          res.ok
            ? { title: `${r.name} is now Star #${n}`, variant: "success" }
            : { title: "Could not assign star", variant: "destructive" }
        );
        if (res.ok) startTransition(() => router.refresh());
        return;
      }
    }
    toast({ title: "All 10 star numbers are taken", variant: "destructive" });
  };

  const removeStar = async (r: Restaurant) => {
    const res = await patch(r.id, { starNumber: null });
    toast(res.ok ? { title: `Star #${r.starNumber} removed`, variant: "success" } : { title: "Could not remove star", variant: "destructive" });
    if (res.ok) startTransition(() => router.refresh());
  };

  const deleteRestaurant = async (id: string) => {
    setDeletingId(id);
    const res = await fetch(`/api/super-admin/restaurants/${id}`, { method: "DELETE" });
    setDeletingId(null);
    setConfirmDelete(null);
    if (res.ok) {
      toast({ title: "Restaurant deleted", variant: "success" });
      startTransition(() => router.refresh());
    } else {
      const err = await res.json();
      toast({ title: "Failed to delete", variant: "destructive", description: err.error });
    }
  };

  const resetPassword = async (id: string) => {
    const password = window.prompt("Set a new temporary password for this restaurant owner (minimum 8 characters):");
    if (!password) return;
    if (password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    const res = await fetch(`/api/super-admin/restaurants/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    toast(res.ok ? { title: "Owner password reset", variant: "success" } : { title: "Could not reset password", variant: "destructive" });
  };

  const editRestaurant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setEditSaving(true);
    const expiresRaw = String(form.get("subscriptionExpiresAt") ?? "");
    const body: Record<string, unknown> = {
      name: form.get("name"),
      phone: form.get("phone") || null,
      address: form.get("address") || null,
      tableLimit: Number(form.get("tableLimit")),
      plan: form.get("plan"),
      bookingsEnabled: form.get("bookingsEnabled") === "on",
      brandColor: form.get("brandColor") || "orange",
      neverExpires: form.get("neverExpires") === "on",
      autoOff: form.get("autoOff") === "on",
      starNote: String(form.get("starNote") ?? "") || null,
    };
    const starRaw = String(form.get("starNumber") ?? "");
    body.starNumber = starRaw === "" ? null : Number(starRaw);
    body.subscriptionExpiresAt = expiresRaw === "" ? null : new Date(expiresRaw).toISOString();

    const res = await fetch(`/api/super-admin/restaurants/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditSaving(false);
    if (res.ok) {
      toast({ title: "Restaurant updated", variant: "success" });
      startTransition(() => router.refresh());
      setEditing(null);
    } else {
      const err = await res.json();
      toast({ title: "Could not update restaurant", variant: "destructive", description: JSON.stringify(err.error) });
    }
  };

  const onSubmit = async (data: RestaurantForm) => {
    const res = await fetch("/api/super-admin/restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast({
        title: `${data.name} created!`,
        variant: "success",
        description: data.starNumber ? `Owner: ${data.ownerEmail} · Star #${data.starNumber}` : `Owner: ${data.ownerEmail} · Plan: ${data.plan ?? "STAR"}`,
      });
      reset({ tableCount: 0, plan: "STAR", starNumber: null });
      setShowForm(false);
      startTransition(() => router.refresh());
    } else {
      const err = await res.json();
      toast({ title: "Error", variant: "destructive", description: err.error ?? JSON.stringify(err) });
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Form */}
      {showForm ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-5">Create New Restaurant</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-sm text-gray-300">Restaurant Name *</label>
              <input {...register("name")} placeholder="Demo Momo House" className={inputCls} />
              {name && <p className="text-xs text-gray-400">Slug: {slugify(name)}</p>}
              {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-300">Owner Name *</label>
              <input {...register("ownerName")} placeholder="Ram Bahadur" className={inputCls} />
              {errors.ownerName && <p className="text-red-400 text-xs">{errors.ownerName.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-300">Owner Email *</label>
              <input type="email" {...register("ownerEmail")} placeholder="owner@restaurant.com" className={inputCls} />
              {errors.ownerEmail && <p className="text-red-400 text-xs">{errors.ownerEmail.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-300">Temporary Password *</label>
              <input type="text" {...register("tempPassword")} placeholder="TempPass123" className={inputCls} />
              {errors.tempPassword && <p className="text-red-400 text-xs">{errors.tempPassword.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-300">Number of Tables</label>
              <input type="number" {...register("tableCount")} min={0} className={inputCls} />
              {errors.tableCount && <p className="text-red-400 text-xs">{errors.tableCount.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-300">Starting plan</label>
              <select {...register("plan")} className={inputCls}>
                <option value="STAR">STAR (founding → assign star #)</option>
                <option value="SILVER">SILVER</option>
                <option value="BRONZE">BRONZE</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-300">Star number (1–10, founding only)</label>
              <input type="number" min={1} max={10} {...register("starNumber")} placeholder="Leave empty if not a founding customer" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-300">Phone</label>
              <input type="text" {...register("phone")} placeholder="98xxxxxxxx" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-300">Location (Google Maps Link)</label>
              <input type="text" {...register("address")} placeholder="https://maps.google.com/..." className={inputCls} />
            </div>
            <div className="col-span-2 flex gap-3 pt-2">
              <button type="submit" disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Restaurant
              </button>
              <button type="button" onClick={() => { setShowForm(false); reset({ tableCount: 0, plan: "STAR", starNumber: null }); }}
                className="px-6 py-2.5 border border-white/20 text-gray-300 rounded-lg text-sm hover:border-white/40 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-gray-500">{restaurants.length} restaurant{restaurants.length === 1 ? "" : "s"} on the platform</p>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium text-sm transition-colors">
            <Plus className="w-4 h-4" />
            Create Restaurant
          </button>
        </div>
      )}

      {/* Restaurants List */}
      <div className="space-y-3">
        {restaurants.map((r) => {
          const planStyle = planStyleVariant(r.plan);
          const sub = subscriptionInfo(r);
          return (
            <div key={r.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
              {editing?.id === r.id && (
                <form onSubmit={editRestaurant} className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
                  <p className="md:col-span-2 text-sm font-semibold text-purple-200">Edit restaurant details &amp; subscription</p>
                  <input name="name" defaultValue={r.name} required className={inputCls} placeholder="Restaurant name" />
                  <input name="phone" defaultValue={r.phone ?? ""} className={inputCls} placeholder="Phone" />
                  <input name="address" defaultValue={r.address ?? ""} className={inputCls} placeholder="Address" />
                  <input name="tableLimit" type="number" min="1" max="200" defaultValue={r.tableLimit} required className={inputCls} placeholder="QR table limit" />
                  <select name="plan" defaultValue={r.plan || "STAR"} className={inputCls}>
                    <option value="STAR">STAR (founding)</option>
                    <option value="SILVER">SILVER</option>
                    <option value="BRONZE">BRONZE</option>
                  </select>
                  <select name="brandColor" defaultValue={r.brandColor || "orange"} className={inputCls}>
                    {BRAND_PALETTES.map((palette) => (
                      <option key={palette.key} value={palette.key}>{palette.label}</option>
                    ))}
                  </select>
                  <select name="starNumber" defaultValue={r.starNumber ?? ""} className={inputCls}>
                    <option value="">Not a star (first-10 off)</option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>Star # {n}</option>
                    ))}
                  </select>
                  <input name="starNote" defaultValue={r.starNote ?? ""} className={inputCls} placeholder="Star note (optional)" />
                  <input
                    name="subscriptionExpiresAt"
                    type="datetime-local"
                    defaultValue={r.subscriptionExpiresAt ? new Date(r.subscriptionExpiresAt).toISOString().slice(0, 16) : ""}
                    className={inputCls}
                  />
                  <div className="flex items-center gap-4 text-sm text-purple-100 flex-wrap">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" name="neverExpires" defaultChecked={r.neverExpires} className="w-4 h-4 accent-purple-500" />
                      Never expires
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" name="autoOff" defaultChecked={r.autoOff} className="w-4 h-4 accent-purple-500" />
                      Auto-off on expiry
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" name="bookingsEnabled" defaultChecked={r.bookingsEnabled} className="w-4 h-4 accent-purple-500" />
                      Enable bookings
                    </label>
                  </div>
                  <p className="md:col-span-2 text-xs text-purple-200/80">
                    The limit controls the maximum number of QR tables the restaurant can create. Assigning a star number puts the
                    restaurant on the STAR plan with an active, never-expiring subscription.
                  </p>
                  <div className="md:col-span-2 flex gap-2">
                    <button disabled={editSaving} className="px-4 py-2 rounded-lg bg-purple-500 text-sm font-medium text-white disabled:opacity-50">
                      {editSaving ? <Loader2 className="w-4 h-4 inline animate-spin mr-1" /> : null}Save changes
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-white/20 text-sm">Cancel</button>
                  </div>
                </form>
              )}
              {/* Confirm delete overlay */}
              {confirmDelete === r.id && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between gap-3">
                  <p className="text-red-300 text-sm font-medium">⚠️ Permanently delete <strong>{r.name}</strong> and all its data?</p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => deleteRestaurant(r.id)}
                      disabled={deletingId === r.id}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                    >
                      {deletingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Yes, Delete
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 border border-white/20 text-gray-300 rounded-lg text-xs">Cancel</button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white">{r.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {r.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${planStyle.badge}`}>{planStyle.label}</span>
                    {r.starNumber != null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        ⭐ Star #{r.starNumber}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sub.className}`}>{sub.label}</span>
                  </div>
                  <p className="text-xs text-gray-400">/{r.slug}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1"><QrCode className="w-3 h-3" /> {r._count.tables} / {r.tableLimit} QR tables</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {r._count.users} users</span>
                    {r.bookingsEnabled && <span className="flex items-center gap-1"><CalendarCheck className="w-3 h-3" /> Bookings on</span>}
                    {r.plan === "SILVER" || r.plan === "BRONZE" ? (
                      <span className={`flex items-center gap-1 ${r.autoOff ? "text-amber-300/80" : "text-gray-500"}`}>
                        <Clock3 className="w-3 h-3" /> auto-off {r.autoOff ? "on" : "off"}
                      </span>
                    ) : null}
                    {r.phone && <span>📞 {r.phone}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => setEditing(r)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/20 text-gray-200 hover:bg-white/10"><Pencil className="w-3.5 h-3.5" /> Edit details</button>
                  <button
                    onClick={() => (r.starNumber != null ? removeStar(r) : assignNextStar(r))}
                    disabled={busyId === r.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 disabled:opacity-50"
                  >
                    <Star className="w-3.5 h-3.5" /> {r.starNumber != null ? `Remove Star #${r.starNumber}` : "Give Star"}
                  </button>
                  <button
                    onClick={() => extendDays(r.id, 30)}
                    disabled={busyId === r.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/20 text-gray-200 hover:bg-white/10 disabled:opacity-50"
                  >
                    <Clock3 className="w-3.5 h-3.5" /> Extend 30 days
                  </button>
                  <button onClick={() => toggleBookings(r.id, r.bookingsEnabled)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      r.bookingsEnabled ? "border border-purple-500/30 text-purple-300 hover:bg-purple-500/10" : "border border-white/20 text-gray-200 hover:bg-white/10"
                    }`}>
                    <CalendarCheck className="w-3.5 h-3.5" /> {r.bookingsEnabled ? "Disable bookings" : "Enable bookings"}
                  </button>
                  <button onClick={() => toggleActive(r.id, r.isActive)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      r.isActive ? "border border-red-500/30 text-red-400 hover:bg-red-500/10" : "border border-green-500/30 text-green-400 hover:bg-green-500/10"
                    }`}>
                    {r.isActive ? <><XCircle className="w-3.5 h-3.5" />Deactivate</> : <><CheckCircle className="w-3.5 h-3.5" />Activate</>}
                  </button>
                  <button onClick={() => resetPassword(r.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-500/30 text-orange-300 hover:bg-orange-500/10"><Users className="w-3.5 h-3.5" /> Reset password</button>
                  <button onClick={() => setConfirmDelete(confirmDelete === r.id ? null : r.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}