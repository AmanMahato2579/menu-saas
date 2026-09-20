import { auth } from "@/lib/auth";

/** Shared API-route guard: true when the signed-in user is a Super Admin. */
export async function isSuperAdminSession(): Promise<boolean> {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "SUPER_ADMIN";
}