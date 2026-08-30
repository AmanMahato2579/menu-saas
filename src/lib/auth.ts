import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
type AuthUser = {
  id?: string;
  role?: string;
  restaurantId?: string | null;
  restaurantSlug?: string | null;
  restaurantName?: string | null;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { restaurant: { select: { id: true, slug: true, name: true } } },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          restaurantId: user.restaurantId,
          restaurantSlug: user.restaurant?.slug ?? null,
          restaurantName: user.restaurant?.name ?? null,
        };
      },
    }),
  ],
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
});
