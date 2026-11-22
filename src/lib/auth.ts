import NextAuth from "next-auth";
import type { Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// In-process brute-force throttle: per-email exponential lockout. Good enough
// for a single instance; swap for a shared store when scaling out.
interface LoginAttempt {
  failures: number;
  lockedUntil: number;
}
const loginAttempts = new Map<string, LoginAttempt>();
const MAX_BUCKETS = 5000;
const LOGIN_SCHEME = {
  startWindowMs: 30_000,
  maxFailures: 5,
  backoffMultiple: 2,
  maxWindowMs: 30 * 60_000, // cap the lockout at 30 minutes
} as const;

function pruneLoginBuckets(): void {
  if (loginAttempts.size < MAX_BUCKETS) return;
  const now = Date.now();
  for (const [email, record] of loginAttempts) {
    if (record.lockedUntil <= now) loginAttempts.delete(email);
  }
}

function isLoginLocked(email: string): boolean {
  if (loginAttempts.size >= MAX_BUCKETS) loginAttempts.clear();
  const record = loginAttempts.get(email);
  return !!record && record.lockedUntil > Date.now();
}

function recordLoginFailure(email: string): void {
  const now = Date.now();
  const record = loginAttempts.get(email);
  const failures = (record ? record.failures : 0) + 1;
  const windowMs = Math.min(
    LOGIN_SCHEME.startWindowMs * Math.pow(LOGIN_SCHEME.backoffMultiple, failures - LOGIN_SCHEME.maxFailures),
    LOGIN_SCHEME.maxWindowMs
  );
  loginAttempts.set(email, {
    failures,
    lockedUntil:
      failures >= LOGIN_SCHEME.maxFailures ? now + Math.max(windowMs, LOGIN_SCHEME.startWindowMs) : 0,
  });
}

function clearLoginFailures(email: string): void {
  loginAttempts.delete(email);
}

pruneLoginBuckets();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) return null;

          const { email, password } = parsed.data;
          const emailKey = email.toLowerCase();

          if (isLoginLocked(emailKey)) return null;

          const user = await prisma.user.findUnique({
            where: { email },
            include: { restaurant: { select: { id: true, slug: true, name: true } } },
          });

          if (!user || !user.passwordHash) {
            recordLoginFailure(emailKey);
            return null;
          }

          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            recordLoginFailure(emailKey);
            return null;
          }

          clearLoginFailures(emailKey);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            restaurantId: user.restaurantId,
            restaurantSlug: user.restaurant?.slug ?? null,
            restaurantName: user.restaurant?.name ?? null,
            tokenVersion: user.tokenVersion,
          };
        } catch (error) {
          console.error("[NextAuth Authorize Error]:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // On every server-side `auth()` call, verify the JWT's tokenVersion against
    // the DB. A password reset (or any forced logout) bumps tokenVersion, so the
    // affected user's older sessions are rejected at the data layer. This runs
    // only in Node (server components / route handlers), never in middleware.
    async session(args) {
      let base: Session = args.session;
      const original = authConfig.callbacks?.session;
      if (original) {
        const mapped = await original(args as Parameters<typeof original>[0]);
        if (mapped) base = mapped as Session;
      }

      const token = args.token as { sub?: string; tokenVersion?: number } | undefined;
      if (token?.sub) {
        const current = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { tokenVersion: true },
        });
        if (!current || (token.tokenVersion ?? 0) !== current.tokenVersion) {
          // Revoked: wipe the user payload so guards treat this as signed out.
          return { ...base, user: {} as Session["user"] };
        }
      }
      return base;
    },
  },
});

export const { GET, POST } = handlers;
