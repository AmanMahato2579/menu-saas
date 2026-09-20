"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Save, Loader2, BadgeCheck } from "lucide-react";

interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: string | number | null;
  priceYearly: string | number | null;
  featureKeys: string;
  limitKeys: string;
  sortOrder: number;
  isVisible: boolean;
  isActive: boolean;
}

interface FeatureDef {
  key: string;
  label: string;
  group: "menu" | "ordering" | "operations";
}

interface GroupDef {
  key: FeatureDef["group"];
  label: string;
}

interface LimitDef {
  key: string;
  label: string;
}

interface Props {
  plans: PlanRow[];
  features: FeatureDef[];
  groups: GroupDef[];
  limits: LimitDef[];
}

interface Draft {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number | null;
  priceYearly: number | null;
  featureKeys: Set<string>;
  limitKeys: Record<string, number>;
  isVisible: boolean;
  isActive: boolean;
}

const ALL = "ALL_CURRENT_FEATURES";

function parseFeatures(json: string): Set<string> {
  try {
    const arr = JSON.parse(json);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function parseLimits(json: string): Record<string, number> {
  try {
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function toDraft(plan: PlanRow): Draft {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    priceMonthly: plan.priceMonthly == null ? null : Number(plan.priceMonthly),
    priceYearly: plan.priceYearly == null ? null : Number(plan.priceYearly),
    featureKeys: parseFeatures(plan.featureKeys),
    limitKeys: parseLimits(plan.limitKeys),
    isVisible: plan.isVisible,
    isActive: plan.isActive,
  };
}

const cardCls = "bg-white/5 border border-white/10 rounded-2xl p-5";
const inputCls = "w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500";

export default function PlanEditorClient({ plans, features, groups }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(plans.map((p) => [p.id, toDraft(p)]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const toggleFeature = (draft: Draft, key: string) => {
    const next = new Set(draft.featureKeys);
    if (next.has(ALL)) {
      next.clear();
      features.forEach((f) => f.key !== key && next.add(f.key));
    } else if (next.has(key)) {
      next.delete(key);
      if (next.size === 0) next.add(ALL);
    } else {
      next.add(key);
    }
    setDraft(draft.id, { featureKeys: next });
  };

  const toggleAll = (draft: Draft, enabled: boolean) => {
    const next = new Set(draft.featureKeys);
    if (enabled) {
      next.clear();
      next.add(ALL);
    } else {
      next.delete(ALL);
    }
    setDraft(draft.id, { featureKeys: next });
  };

  const save = async (draft: Draft) => {
    setSavingId(draft.id);
    try {
      const featuresArr = draft.featureKeys.has(ALL)
        ? [ALL]
        : [...draft.featureKeys];
      const res = await fetch("/api/super-admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          name: draft.name,
          description: draft.description,
          priceMonthly: draft.priceMonthly,
          priceYearly: draft.priceYearly,
          featureKeys: featuresArr.length === 0 ? ALL : featuresArr,
          limitKeys: draft.limitKeys,
          isVisible: draft.isVisible,
          isActive: draft.isActive,
          sortOrder: undefined,
        }),
      });
      if (res.ok) {
        toast({ title: `${draft.name} saved`, variant: "success" });
        router.refresh();
      } else {
        const err = await res.json();
        toast({ title: "Could not save plan", variant: "destructive", description: JSON.stringify(err.error ?? err) });
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {plans.map((plan) => {
        const draft = drafts[plan.id];
        if (!draft) return null;
        const allOn = draft.featureKeys.has(ALL);
        return (
          <div key={plan.id} className={`${cardCls} ${!draft.isActive ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <BadgeCheck className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{draft.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/10">{draft.id}</span>
                    {draft.isVisible ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Listed</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">Hidden</span>
                    )}
                  </div>
                  <input
                    value={draft.description ?? ""}
                    onChange={(e) => setDraft(draft.id, { description: e.target.value })}
                    placeholder="Short description shown to customers"
                    className={`${inputCls} mt-1 text-xs`}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={draft.isVisible} onChange={(e) => setDraft(draft.id, { isVisible: e.target.checked })} className="w-4 h-4 accent-purple-500" />
                  Visible
                </label>
                <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft(draft.id, { isActive: e.target.checked })} className="w-4 h-4 accent-purple-500" />
                  Active ({draft.isActive ? "applied at runtime" : "falls back to built-in defaults"})
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Monthly price (Rs.)</label>
                <input
                  type="number" min={0} step="0.01"
                  value={draft.priceMonthly ?? ""}
                  onChange={(e) => setDraft(draft.id, { priceMonthly: e.target.value === "" ? null : Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Yearly price (Rs.)</label>
                <input
                  type="number" min={0} step="0.01"
                  value={draft.priceYearly ?? ""}
                  onChange={(e) => setDraft(draft.id, { priceYearly: e.target.value === "" ? null : Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-400">QR table limit</label>
                <input
                  type="number" min={1} max={500}
                  value={draft.limitKeys.qrTables ?? 0}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isFinite(value)) setDraft(draft.id, { limitKeys: { ...draft.limitKeys, qrTables: value } });
                  }}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Feature access</p>
              {!allOn && (
                <button onClick={() => toggleAll(draft, true)} className="text-xs text-purple-300 hover:text-purple-200 underline underline-offset-2">
                  Grant everything (STAR-style)
                </button>
              )}
              {allOn && (
                <button onClick={() => toggleAll(draft, false)} className="text-xs text-gray-400 hover:text-gray-300 underline underline-offset-2">
                  Switch to custom selection
                </button>
              )}
            </div>

            {allOn ? (
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm text-purple-200">
                ALL_CURRENT_FEATURES — every current and future platform feature is automatically granted to this plan.
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.key}>
                    <p className="text-xs font-medium text-gray-300 mb-2">{group.label}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {features.filter((f) => f.group === group.key).map((feature) => (
                        <label key={feature.key} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition-colors">
                          <input
                            type="checkbox"
                            checked={draft.featureKeys.has(feature.key)}
                            onChange={() => toggleFeature(draft, feature.key)}
                            className="w-4 h-4 accent-purple-500"
                          />
                          {feature.label}
                          <span className="ml-auto text-[10px] text-gray-500">{feature.key}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-5">
              <button
                onClick={() => save(draft)}
                disabled={savingId === draft.id}
                className="flex items-center gap-2 px-5 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {savingId === draft.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save {draft.name}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}