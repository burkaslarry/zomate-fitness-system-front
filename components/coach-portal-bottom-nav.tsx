"use client";

/**
 * [F008][S005]
 * Feature: Coach Session Management
 * Step: Coach portal — 5 bottom tabs (排程 | 學員 | 已付 | 報Course | 出勤)
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  {
    id: "schedule",
    label: "排程",
    href: "/coach-portal?tab=schedule",
    match: (path: string, tab: string | null) =>
      path === "/coach-portal" && (!tab || tab === "schedule")
  },
  {
    id: "students",
    label: "學員",
    href: "/coach-portal?tab=students",
    match: (path: string, tab: string | null) => path === "/coach-portal" && tab === "students"
  },
  {
    id: "payments",
    label: "已付",
    href: "/coach-portal?tab=payments",
    match: (path: string, tab: string | null) => path === "/coach-portal" && tab === "payments"
  },
  {
    id: "reg-course",
    label: "報Course",
    href: "/coach-portal/reg-course",
    match: (path: string, _tab: string | null) => path.startsWith("/coach-portal/reg-course")
  },
  {
    id: "report",
    label: "出勤",
    href: "/coach-portal/report",
    match: (path: string, _tab: string | null) => path.startsWith("/coach-portal/report")
  }
] as const;

export default function CoachPortalBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return (
    <nav
      data-coach-portal-tabs
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink/10 bg-surface/95 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-lg">
        {TABS.map((item) => {
          const active = item.match(pathname, tab);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition sm:text-[11px] ${
                active ? "text-primary" : "text-ink/55 hover:text-ink"
              }`}
            >
              <span
                className={`h-1 w-6 rounded-full sm:w-8 ${active ? "bg-primary" : "bg-transparent"}`}
                aria-hidden
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
