"use client";

/**
 * [F003][S001]
 * Feature: Attendance & Today-Only QR Check-in
 * Step: (see Logic)
 * Logic: Restricts coach-role routes and API scope.
 */

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthSession } from "../lib/auth";

export default function CoachScopeGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const s = getAuthSession();
    if (s?.role !== "COACH") return;
    if (pathname === "/coach" || pathname === "/coach/calendar") return;
    if (pathname.startsWith("/coach/")) return;
    router.replace("/coach");
  }, [pathname, router]);

  return <>{children}</>;
}
