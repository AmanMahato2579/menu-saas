import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isSuperAdminRoute = nextUrl.pathname.startsWith("/super-admin");
  const isLoginPage = nextUrl.pathname === "/login";

  if (isLoginPage && isLoggedIn) {
    const role = (req.auth?.user as { role?: string })?.role;
    if (role === "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/super-admin", nextUrl));
    }
    return NextResponse.redirect(new URL("/admin", nextUrl));
  }

  if ((isAdminRoute || isSuperAdminRoute) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isSuperAdminRoute && isLoggedIn) {
    const role = (req.auth?.user as { role?: string })?.role;
    if (role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/admin", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|manifest).*)"],
};
