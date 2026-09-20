"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Save, Loader2 } from "lucide-react";

interface Settings {
  platformName: string;
  defaultTableLimit: number;
  defaultSubscriptionDays: number;
  newRestaurantNeverExpires: boolean;
  newRestaurantAutoOff: boolean;
}

const inputCls = "w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500";

export default function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<Settings>) => setForm((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast({ title: "Settings saved", variant: "success" });
        router.refresh();
      } else {
        const err = await res.json();
        toast({ title: "Could not save settings", variant: "destructive", description: JSON.stringify(err.error) });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-2xl space-y-6">
      <div className="space-y-1">
        <label className="text-sm text-gray-300">Platform name</label>
        <input value={form.platformName} onChange={(e) => update({ platformName: e.target.value })} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm text-gray-300">Default QR table limit</label>
          <input
            type="number" min={1} max={200}
            value={form.defaultTableLimit}
            onChange={(e) => update({ defaultTableLimit: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-300">Default subscription length (days)</label>
          <input
            type="number" min={1} max={3650}
            value={form.defaultSubscriptionDays}
            onChange={(e) => update({ defaultSubscriptionDays: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
      </div>
      <div className="space-y-3">
        <label className="flex items-center gap-2.5 text-sm text-gray-200 cursor-pointer">
          <input
            type="checkbox"
            checked={form.newRestaurantNeverExpires}
            onChange={(e) => update({ newRestaurantNeverExpires: e.target.checked })}
            className="w-4 h-4 accent-purple-500"
          />
          New restaurants start with <strong>never-expires</strong> subscriptions
        </label>
        <label className="flex items-center gap-2.5 text-sm text-gray-200 cursor-pointer">
          <input
            type="checkbox"
            checked={form.newRestaurantAutoOff}
            onChange={(e) => update({ newRestaurantAutoOff: e.target.checked })}
            className="w-4 h-4 accent-purple-500"
          />
          Automatically deactivate (auto-off) restaurants when their subscription expires
        </label>
        <p className="text-xs text-gray-500">
          When auto-off is ON, an expired subscription disables the restaurant until the Super Admin reactivates or extends it.
          When OFF, expired restaurants keep running but are flagged as expired in the dashboard.
        </p>
      </div>
      <div className="flex justify-end pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save settings
        </button>
      </div>
    </div>
  );
}