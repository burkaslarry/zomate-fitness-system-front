"use client";

/**
 * [F008][S005]
 * Feature: Coach Session Management
 * Step: Coach portal — 5 bottom tabs with icons
 */

import { CalendarDays, ClipboardList, CreditCard, UserRound, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";

const TABS: {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  match: (path: string, tab: string | null) => boolean;
}[] = [
  {
    id: "schedule",
    label: "排程",
    href: "/coach-portal?tab=schedule",
    icon: CalendarDays,
    match: (path, tab) => path === "/coach-portal" && (!tab || tab === "schedule")
  },
  {
    id: "students",
    label: "學員",
    href: "/coach-portal?tab=students",
    icon: UserRound,
    match: (path, tab) => path === "/coach-portal" && tab === "students"
  },
  {
    id: "payments",
    label: "已付",
    href: "/coach-portal?tab=payments",
    icon: CreditCard,
    match: (path, tab) => path === "/coach-portal" && tab === "payments"
  },
  {
    id: "reg-course",
    label: "報Course",
    href: "/coach-portal/reg-course",
    icon: UserPlus,
    match: (path) => path.startsWith("/coach-portal/reg-course")
  },
  {
    id: "report",
    label: "出勤",
    href: "/coach-portal/report",
    icon: ClipboardList,
    match: (path) => path.startsWith("/coach-portal/report")
  }
];

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
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition sm:text-[11px] ${
                active ? "text-black" : "text-ink/55 hover:text-ink"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${active ? "text-black" : "text-ink/45"}`}
                strokeWidth={active ? 2.25 : 1.75}
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
