"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/components/ui/toast";
import { Plus, Building2, Users, QrCode, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { slugify } from "@/lib/utils";

const restaurantSchema = z.object({
  name: z.string().min(2, "Name too short"),
  ownerName: z.string().min(1, "Required"),
  ownerEmail: z.string().email("Invalid email"),
  tempPassword: z.string().min(6, "Min 6 chars"),
  tableCount: z.coerce.number().int().min(1).max(200),
});

type RestaurantForm = z.infer<typeof restaurantSchema>;

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  _count: { tables: number; users: number };
}

interface Props {
  restaurants: Restaurant[];
}

export default function SuperAdminClient({ restaurants }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<RestaurantForm>({ resolver: zodResolver(restaurantSchema) as unknown as Resolver<RestaurantForm>, defaultValues: { tableCount: 5 } });

  const name = watch("name");

  const toggleActive = async (id: string, current: boolean) => {
    await fetch(`/api/super-admin/restaurants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    toast({ title: current ? "Restaurant deactivated" : "Restaurant activated", variant: "success" });
    startTransition(() => router.refresh());
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
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Total Restaurants</p>
          <p className="text-3xl font-bold text-white mt-1">{restaurants.length}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Active</p>
          <p className="text-3xl font-bold text-green-400 mt-1">
            {restaurants.filter((r) => r.isActive).length}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Inactive</p>
          <p className="text-3xl font-bold text-red-400 mt-1">
            {restaurants.filter((r) => !r.isActive).length}
          </p>
        </div>
      </div>

      {/* Create Form */}
      {showForm ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-5">Create New Restaurant</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-sm text-gray-300">Restaurant Name *</label>
              <input {...register("name")} placeholder="Demo Momo House"
                className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              {name && <p className="text-xs text-gray-400">Slug: {slugify(name)}</p>}
              {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-300">Owner Name *</label>
              <input {...register("ownerName")} placeholder="Ram Bahadur"
                className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              {errors.ownerName && <p className="text-red-400 text-xs">{errors.ownerName.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-300">Owner Email *</label>
              <input type="email" {...register("ownerEmail")} placeholder="owner@restaurant.com"
                className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              {errors.ownerEmail && <p className="text-red-400 text-xs">{errors.ownerEmail.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-300">Temporary Password *</label>
              <input type="text" {...register("tempPassword")} placeholder="TempPass123"
                className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              {errors.tempPassword && <p className="text-red-400 text-xs">{errors.tempPassword.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-300">Number of Tables</label>
              <input type="number" {...register("tableCount")} min={1}
                className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              {errors.tableCount && <p className="text-red-400 text-xs">{errors.tableCount.message}</p>}
            </div>
            <div className="col-span-2 flex gap-3 pt-2">
              <button type="submit" disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Restaurant
              </button>
              <button type="button" onClick={() => setShowForm(false)}
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
          <div key={r.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white">{r.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                  {r.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-xs text-gray-400">/{r.slug}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                <span className="flex items-center gap-1"><QrCode className="w-3 h-3" /> {r._count.tables} tables</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {r._count.users} users</span>
              </div>
            </div>
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
          </div>
        ))}
      </div>
    </div>
  );
}
