import { prisma } from "@/lib/prisma";

// Centralized platform settings kept in the lightweight PlatformSetting
// key/value table. Used as sensible defaults by the Super Admin workflows.

export interface PlatformSettings {
  platformName: string;
  defaultTableLimit: number;
  defaultSubscriptionDays: number;
  newRestaurantNeverExpires: boolean;
  newRestaurantAutoOff: boolean;
}

export const PLATFORM_SETTING_DEFAULTS: PlatformSettings = {
  platformName: "MenuQR",
  defaultTableLimit: 20,
  defaultSubscriptionDays: 365,
  newRestaurantNeverExpires: true,
  newRestaurantAutoOff: true,
};

function parse(value: string | undefined, def: string): string {
  return value ?? def;
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const rows = await prisma.platformSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const bool = (key: string, def: boolean) => {
    const v = map.get(key);
    if (v === undefined || v === null || v === "") return def;
    return v === "true" || v === "1";
  };
  const int = (key: string, def: number) => {
    const v = Number.parseInt(map.get(key) ?? "", 10);
    return Number.isFinite(v) && v >= 0 ? v : def;
  };

  return {
    platformName: parse(map.get("platformName"), PLATFORM_SETTING_DEFAULTS.platformName),
    defaultTableLimit: int("defaultTableLimit", PLATFORM_SETTING_DEFAULTS.defaultTableLimit),
    defaultSubscriptionDays: int("defaultSubscriptionDays", PLATFORM_SETTING_DEFAULTS.defaultSubscriptionDays),
    newRestaurantNeverExpires: bool("newRestaurantNeverExpires", PLATFORM_SETTING_DEFAULTS.newRestaurantNeverExpires),
    newRestaurantAutoOff: bool("newRestaurantAutoOff", PLATFORM_SETTING_DEFAULTS.newRestaurantAutoOff),
  };
}

export async function savePlatformSettings(patch: Partial<PlatformSettings>) {
  const entries: { key: string; value: string }[] = [];
  if (patch.platformName !== undefined) entries.push({ key: "platformName", value: patch.platformName });
  if (patch.defaultTableLimit !== undefined) entries.push({ key: "defaultTableLimit", value: String(patch.defaultTableLimit) });
  if (patch.defaultSubscriptionDays !== undefined) entries.push({ key: "defaultSubscriptionDays", value: String(patch.defaultSubscriptionDays) });
  if (patch.newRestaurantNeverExpires !== undefined) entries.push({ key: "newRestaurantNeverExpires", value: String(patch.newRestaurantNeverExpires) });
  if (patch.newRestaurantAutoOff !== undefined) entries.push({ key: "newRestaurantAutoOff", value: String(patch.newRestaurantAutoOff) });

  for (const { key, value } of entries) {
    await prisma.platformSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}