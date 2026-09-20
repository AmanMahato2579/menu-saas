import { requireSuperAdmin } from "@/lib/auth-guard";
import { getPlatformSettings } from "@/lib/settings";
import SettingsForm from "./SettingsForm";

export const metadata = { title: "Settings – Super Admin" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireSuperAdmin();
  const settings = await getPlatformSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Defaults applied when a new restaurant is onboarded.</p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}