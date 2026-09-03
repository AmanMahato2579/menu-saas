"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/components/ui/toast";
import { Plus, Building2, Users, QrCode, CheckCircle, XCircle, Loader2, Trash2, Pencil, LogOut } from "lucide-react";
import { slugify } from "@/lib/utils";
import InstallPWA from "@/components/admin/InstallPWA";

const restaurantSchema = z.object({
  name: z.string().min(2, "Name too short"),
  ownerName: z.string().min(1, "Required"),
  ownerEmail: z.string().email("Invalid email"),
  tempPassword: z.string().min(6, "Min 6 chars"),
  tableCount: z.coerce.number().int().min(1).max(200),
  phone: z.string().optional(),
  address: z.string().optional(),
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
  createdAt: string;
  _count: { tables: number; users: number };
}

interface Props {
  restaurants: Restaurant[];
}

const inputCls = "w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

export default function SuperAdminClient({ restaurants }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<RestaurantForm>({ resolver: zodResolver(restaurantSchema) as unknown as Resolver<RestaurantForm>, defaultValues: { tableCount: 5 } });

  const name = watch("name");

  const toggleActive = async (id: string, current: boolean) => {
    const res = await fetch(`/api/super-admin/restaurants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    if (res.ok) {
      toast({ title: current ? "Restaurant deactivated" : "Restaurant activated", variant: "success" });
      startTransition(() => router.refresh());
    } else {
      toast({ title: "Error updating status", variant: "destructive" });
    }
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
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };
  const resetPassword = async (id: string) => {
    const password = window.prompt("Set a new temporary password for this restaurant owner (minimum 8 characters):");
    if (!password) return;
    const res = await fetch(`/api/super-admin/restaurants/${id}/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    toast(res.ok ? { title: "Owner password reset", variant: "success" } : { title: "Could not reset password", variant: "destructive" });
  };
  const editRestaurant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setEditSaving(true);
    const res = await fetch(`/api/super-admin/restaurants/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), phone: form.get("phone") || null, address: form.get("address") || null, tableLimit: Number(form.get("tableLimit")), plan: form.get("plan") }) });
    setEditSaving(false);
    if (res.ok) { toast({ title: "Restaurant updated", variant: "success" }); startTransition(() => router.refresh()); }
    else toast({ title: "Could not update restaurant", variant: "destructive" });
    if (res.ok) setEditing(null);
  };

  const onSubmit = async (data: RestaurantForm) => {
    const res = await fetch("/api/super-admin/restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast({ title: `${data.name} created!`, variant: "success", description: `Owner: ${data.ownerEmail}` });
      reset({ tableCount: 5 });
      setShowForm(false);
      startTransition(() => router.refresh());
    } else {
      const err = await res.json();
      toast({ title: "Error", variant: "destructive", description: err.error });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end items-center gap-3">
        <div className="w-48">
          <InstallPWA />
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 text-gray-300 text-sm hover:border-red-500/40 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Total Restaurants</p>
          <p className="text-3xl font-bold text-white mt-1">{restaurants.length}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Active</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{restaurants.filter((r) => r.isActive).length}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Inactive</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{restaurants.filter((r) => !r.isActive).length}</p>
        </div>
      </div>

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
              <input type="number" {...register("tableCount")} min={1} className={inputCls} />
              {errors.tableCount && <p className="text-red-400 text-xs">{errors.tableCount.message}</p>}
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
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Restaurant
              </button>
              <button type="button" onClick={() => { setShowForm(false); reset({ tableCount: 5 }); }}
                className="px-6 py-2.5 border border-white/20 text-gray-300 rounded-lg text-sm hover:border-white/40 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium text-sm transition-colors">
          <Plus className="w-4 h-4" />
          Create Restaurant
        </button>
      )}

      {/* Restaurants List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-300">All Restaurants</h2>
        {restaurants.map((r) => (
          <div key={r.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
            {editing?.id === r.id && (
              <form onSubmit={editRestaurant} className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                <p className="md:col-span-2 text-sm font-semibold text-orange-200">Edit restaurant and QR table limit</p>
                <input name="name" defaultValue={r.name} required className={inputCls} placeholder="Restaurant name" />
                <input name="phone" defaultValue={r.phone ?? ""} className={inputCls} placeholder="Phone" />
                <input name="address" defaultValue={r.address ?? ""} className={inputCls} placeholder="Address" />
                <input name="tableLimit" type="number" min="1" max="200" defaultValue={r.tableLimit} required className={inputCls} placeholder="QR table limit" />
                <div className="md:col-span-2 space-y-1">
                  <p className="text-xs text-orange-200 font-medium">Restaurant Plan</p>
                  <select name="plan" defaultValue={r.plan || "STAR"} className={inputCls}>
                    <option value="STAR">⭐ STAR (Elite)</option>
                    <option value="GOLD">🥇 GOLD</option>
                    <option value="SILVER">🥈 SILVER</option>
                    <option value="BRONZE">🥉 BRONZE</option>
                  </select>
                </div>
                <p className="md:col-span-2 text-xs text-orange-200/80">The limit controls the maximum number of QR tables the restaurant can create. It cannot be set below the existing table count.</p>
                <div className="md:col-span-2 flex gap-2"><button disabled={editSaving} className="px-4 py-2 rounded-lg bg-orange-500 text-sm font-medium text-white">{editSaving ? "Saving…" : "Save changes"}</button><button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-white/20 text-sm">Cancel</button></div>
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
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white">{r.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {r.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    r.plan === "GOLD" ? "bg-yellow-500/20 text-yellow-300" :
                    r.plan === "SILVER" ? "bg-gray-400/20 text-gray-300" :
                    r.plan === "BRONZE" ? "bg-orange-700/20 text-orange-400" :
                    "bg-purple-500/20 text-purple-300"
                  }`}>
                    {r.plan === "GOLD" ? "🥇 GOLD" : r.plan === "SILVER" ? "🥈 SILVER" : r.plan === "BRONZE" ? "🥉 BRONZE" : "⭐ STAR"}
                  </span>
                </div>
                <p className="text-xs text-gray-400">/{r.slug}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                  <span className="flex items-center gap-1"><QrCode className="w-3 h-3" /> {r._count.tables} / {r.tableLimit} QR tables</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {r._count.users} users</span>
                  {r.phone && <span>📞 {r.phone}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => setEditing(r)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/20 text-gray-200 hover:bg-white/10"><Pencil className="w-3.5 h-3.5" /> Edit details</button>
                <button
                  onClick={() => toggleActive(r.id, r.isActive)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    r.isActive
                      ? "border border-red-500/30 text-red-400 hover:bg-red-500/10"
                      : "border border-green-500/30 text-green-400 hover:bg-green-500/10"
                  }`}
                >
                  {r.isActive ? <><XCircle className="w-3.5 h-3.5" />Deactivate</> : <><CheckCircle className="w-3.5 h-3.5" />Activate</>}
                </button>
                <button onClick={() => resetPassword(r.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-500/30 text-orange-300 hover:bg-orange-500/10"><Users className="w-3.5 h-3.5" /> Reset password</button>
                <button
                  onClick={() => setConfirmDelete(confirmDelete === r.id ? null : r.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
