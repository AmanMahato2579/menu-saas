import type { NextAuthConfig } from "next-auth";

type AuthUser = {
  id?: string;
  role?: string;
  restaurantId?: string | null;
  restaurantSlug?: string | null;
  restaurantName?: string | null;
};

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

if (!authSecret && process.env.NODE_ENV === "production") {
  console.warn(
    "[NextAuth] Missing AUTH_SECRET/NEXTAUTH_SECRET. Set this in Vercel Project Settings before deploying."
  );
}

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  secret: authSecret,
  trustHost: true,
  debug: process.env.NODE_ENV === "development",

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as AuthUser;

        token.role = u.role;
        token.restaurantId = u.restaurantId;
        token.restaurantSlug = u.restaurantSlug;
        token.restaurantName = u.restaurantName;
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;

        const u = session.user as unknown as AuthUser;

        u.role = token.role as string | undefined;
        u.restaurantId = token.restaurantId as string | undefined;
        u.restaurantSlug = token.restaurantSlug as string | undefined;
        u.restaurantName = token.restaurantName as string | undefined;
      }

      return session;
    },
  },
};