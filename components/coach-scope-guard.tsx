"use client";

/*
 * CF09:CoachScopeGuard — AppUser.role=COACH 時只許停留在 `/coach/calendar`；
 * Session 存在 localStorage，Edge middleware 讀唔到，故此用 client effect 兜底。
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
    if (pathname === "/coach/calendar") return;
    router.replace("/coach/calendar");
  }, [pathname, router]);

  return <>{children}</>;
}
