import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function withPoolerParams(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const isSupabaseTransactionPooler =
      parsed.hostname.includes("pooler.supabase.com") && parsed.port === "6543";
    const isPgBouncer = parsed.searchParams.get("pgbouncer") === "true";

    // Supabase PgBouncer transaction pooler (port 6543) does not support prepared
    // statements. Prisma needs pgbouncer=true to disable them, and a low connection
    // limit is safer for serverless.
    if (isSupabaseTransactionPooler || isPgBouncer) {
      if (!parsed.searchParams.has("pgbouncer")) {
        parsed.searchParams.set("pgbouncer", "true");
      }
      if (!parsed.searchParams.has("connection_limit")) {
        parsed.searchParams.set("connection_limit", "1");
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
    datasourceUrl: withPoolerParams(process.env.DATABASE_URL),
    errorFormat: "minimal",
  });

globalForPrisma.prisma = prisma;
