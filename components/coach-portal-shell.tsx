"use client";

/**
 * [F008][S005]
 * Feature: Coach Session Management
 * Step: Coach portal bottom tab navigation
 * Logic: Mobile-first tabs — 教練上堂 (hourly schedule) | 報Course | 教練出勤.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import BackendShell from "./backend-shell";

const TABS = [
  { href: "/coach-portal", label: "教練上堂", match: (p: string) => p === "/coach-portal" || p.startsWith("/coach-portal/calendar") },
  {
    href: "/coach-portal/reg-course",
    label: "報Course",
    match: (p: string) => p.startsWith("/coach-portal/reg-course")
  },
  {
    href: "/coach-portal/report",
    label: "教練出勤",
    match: (p: string) => p.startsWith("/coach-portal/report")
  }
] as const;

export default function CoachPortalShell({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  const pathname = usePathname();

  return (
    <BackendShell layout="coach" title={title}>
      {children}
      <nav
        data-coach-portal-tabs
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink/10 bg-surface/95 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-lg">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                  active ? "text-primary" : "text-ink/55 hover:text-ink"
                }`}
              >
                <span
                  className={`h-1 w-8 rounded-full ${active ? "bg-primary" : "bg-transparent"}`}
                  aria-hidden
                />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </BackendShell>
  );
}
