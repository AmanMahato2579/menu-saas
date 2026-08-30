import type { NextAuthConfig } from "next-auth";

type AuthUser = {
  id?: string;
  role?: string;
  restaurantId?: string | null;
  restaurantSlug?: string | null;
  restaurantName?: string | null;
};

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "menu-saas-production-auth-secret-key-3oNyp6k+NvGM2+/+LAjKd6OmcO371DDUeakqOydl5sc=",
  trustHost: true,
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
