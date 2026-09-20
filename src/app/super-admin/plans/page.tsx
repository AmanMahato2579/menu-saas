import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { FEATURE_CATALOG, FEATURE_GROUPS, LIMIT_CATALOG } from "@/lib/plan-catalog";
import PlanEditorClient from "./PlanEditorClient";

export const metadata = { title: "Plans – Super Admin" };
export const dynamic = "force-dynamic";

export default async function PlansPage() {
  await requireSuperAdmin();
  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plans &amp; Pricing</h1>
        <p className="text-gray-400 text-sm mt-1">
          Configure what each plan unlocks. Feature and limit changes apply to every restaurant on the plan.
          STAR uses the <code className="text-purple-300">ALL_CURRENT_FEATURES</code> marker — new platform features are granted automatically.
        </p>
      </div>
      <PlanEditorClient
        plans={JSON.parse(JSON.stringify(plans))}
        features={FEATURE_CATALOG}
        groups={FEATURE_GROUPS}
        limits={LIMIT_CATALOG}
      />
    </div>
  );
}