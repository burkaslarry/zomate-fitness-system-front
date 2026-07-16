"use client";

/**
 * [F008][S005]
 * Feature: Coach Session Management
 * Step: Coach-only route guard and portal redirect
 * Logic: COACH → /coach-portal; block /admin/**; legacy /coach routes redirect.
 */

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthSession } from "../lib/auth";

const COACH_ALLOWED_PREFIXES = ["/coach-portal", "/coach/calendar", "/coach", "/login", "/student"];

function coachMayAccess(pathname: string): boolean {
  if (pathname === "/") return true;
  return COACH_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export default function CoachScopeGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const s = getAuthSession();
    if (s?.role !== "COACH") return;

    if (pathname === "/coach" || pathname.startsWith("/coach/") && !pathname.startsWith("/coach-portal")) {
      if (pathname === "/coach/calendar") {
        router.replace("/coach-portal/calendar");
        return;
      }
      if (pathname === "/coach" || pathname.startsWith("/coach/")) {
        router.replace("/coach-portal");
        return;
      }
    }

    if (pathname.startsWith("/admin")) {
      router.replace("/coach-portal");
      return;
    }

    if (!coachMayAccess(pathname)) {
      router.replace("/coach-portal");
    }
  }, [pathname, router]);

  return <>{children}</>;
}
