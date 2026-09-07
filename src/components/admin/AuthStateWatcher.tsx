"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthStateWatcher() {
  const router = useRouter();

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      // Only refresh when the page is restored from the back/forward cache AND
      // the session cookie is still present. This avoids forcing a logout when
      // a mobile browser restores the PWA from bfcache but the cookie is intact.
      if (e.persisted) {
        const hasSessionCookie = document.cookie
          .split(";")
          .some((c) => c.trim().startsWith("authjs.session-token="));
        if (hasSessionCookie) {
          router.refresh();
        }
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [router]);

  return null;
}
