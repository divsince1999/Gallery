"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

/**
 * Guards against the browser Back-Forward Cache (bfcache) restoring
 * a protected dashboard page after the user has logged out.
 *
 * When bfcache restores a page it fires a `pageshow` event with
 * `event.persisted === true` — no network request is made, so the
 * server-side proxy auth check never runs. This component detects
 * that case and redirects to /login immediately.
 */
export default function BfcacheGuard() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // `persisted` is true only when the page is restored from bfcache
      if (event.persisted && status === "unauthenticated") {
        window.location.replace("/login");
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [status, router]);

  // Also guard on initial mount — handles the case where the session
  // expires while the user has the dashboard open.
  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.replace("/login");
    }
  }, [status]);

  return null;
}
