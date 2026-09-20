import { requireSuperAdmin } from "@/lib/auth-guard";
import { listActivity, actionLabel } from "@/lib/activity";

export const metadata = { title: "Activity – Super Admin" };
export const dynamic = "force-dynamic";

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ActivityPage() {
  await requireSuperAdmin();
  const activities = await listActivity({ limit: 120 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Trail</h1>
        <p className="text-gray-400 text-sm mt-1">Important actions performed across the platform.</p>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {activities.length === 0 ? (
          <p className="text-gray-500 text-sm p-6">No activity recorded yet.</p>
        ) : (
          <div className="divide-y divide-white/10">
            {activities.map((activity) => (
              <div key={activity.id} className="px-5 py-3.5 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-white">{actionLabel(activity.action)}</span>
                    {activity.restaurantName && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/10">{activity.restaurantName}</span>
                    )}
                  </div>
                  {activity.detail && <p className="text-xs text-gray-400 mt-0.5">{activity.detail}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{formatDate(activity.createdAt)}</p>
                  {activity.actorEmail && <p className="text-[10px] text-gray-600">{activity.actorEmail}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}