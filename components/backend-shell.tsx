"use client";

/**
 * [F006][S002]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: Authenticated admin layout shell and navigation.
 */

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthSession, getAuthSession, type AuthSession } from "../lib/auth";
import { api, getResolvedApiBaseUrl, isUsingNextMockApi } from "../lib/api";
import { PERIODIC_HEALTH_INTERVAL_MS } from "../hooks/use-periodic-health-ping";

type NavItem = { href: string; label: string };

const MENU_SECTIONS: { frameClass: string; items: NavItem[] }[] = [
  {
    frameClass: "rounded-xl border-2 border-primary/50 bg-primary/5 p-2.5",
    items: [
      { href: "/admin", label: "後台面板" },
      { href: "/register", label: "+ 新會員" },
      { href: "/renewal", label: "+ 會員報堂" },
      { href: "/trial-class", label: "+ 試堂/加堂" }
    ]
  },
  {
    frameClass: "rounded-xl border-2 border-ink/15 bg-surface/80 p-2.5",
    items: [
      { href: "/admin/students", label: "學生名單" },
      { href: "/admin/coaches", label: "教練" }
    ]
  },
  {
    frameClass: "rounded-xl border-2 border-primary/25 bg-canvas p-2.5",
    items: [
      { href: "/admin/branches", label: "分店管理" },
      { href: "/admin/course-set", label: "Course 套餐開課" },
      { href: "/coach/calendar", label: "教練日程 · 簽到" },
      { href: "/coach", label: "教練課表" },
      { href: "/admin/attendance/qr-console", label: "QR 簽到中心" },
      { href: "/admin/attendance/session-ledger", label: "Session Ledger · 扣堂原因" },
      { href: "/student/trial", label: "試堂 / 開課管理" },
      { href: "/student", label: "學生入口" }
    ]
  },
  {
    frameClass: "rounded-xl border-2 border-ink/12 bg-surface/60 p-2.5",
    items: [
      { href: "/admin/finance/sales", label: "銷售與分期" },
      { href: "/admin/finance/expenses", label: "支出管理" },
      { href: "/admin/finance/payroll", label: "薪酬 / 出勤報表" }
    ]
  },
  {
    frameClass: "rounded-xl border-2 border-ink/10 bg-canvas p-2.5",
    items: [{ href: "/admin/settings/whatsapp", label: "Whatsapp 設定" }]
  }
];

function navLinkClass(active: boolean): string {
  return `flex items-center gap-3 rounded-lg border-l-[3px] border-transparent px-2.5 py-2 text-[13px] leading-5 transition ${
    active
      ? "border-primary bg-primary/15 text-ink shadow-[inset_0_0_0_1px_rgba(45,36,34,0.06)]"
      : "text-ink/80 hover:bg-canvas/80 hover:text-ink"
  }`;
}

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/coach") return pathname === "/coach";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BackendShell({
  children,
  title,
  layout = "admin"
}: {
  children: ReactNode;
  title: string;
  /** `coach`: 教練入口 — 無左欄、全寬內容（配合行動版主畫面） */
  layout?: "admin" | "coach";
}) {
  /** Verified session from `/api/auth/me`; `null` until first successful ping */
  const [verifiedSession, setVerifiedSession] = useState<AuthSession | null>(null);
  /** 已確認無效／已登出，準備顯示空白並由 login 接手 */
  const [rejected, setRejected] = useState(false);
  /** 來自 localStorage（僅在 client mounted 後讀取，避免 SSR hydration 不匹配） */
  const [storedSession, setStoredSession] = useState<AuthSession | null>(null);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [dbStatus, setDbStatus] = useState<"idle" | "checking" | "ok" | "error" | "na">("idle");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const s = getAuthSession();
    setStoredSession(s);
    if (!s) {
      router.replace("/login");
      setRejected(true);
      return;
    }
    void api
      .me()
      .then(() => {
        if (!cancelled) setVerifiedSession(s);
      })
      .catch(() => {
        clearAuthSession();
        setStoredSession(null);
        if (!cancelled) {
          setRejected(true);
          router.replace("/login");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const probe = () => {
      void (async () => {
        try {
          await api.health();
          if (cancelled) return;
          setApiStatus("online");
          if (isUsingNextMockApi()) {
            if (!cancelled) setDbStatus("na");
            return;
          }
          if (!cancelled) setDbStatus("checking");
          try {
            await api.healthDb();
            if (!cancelled) setDbStatus("ok");
          } catch {
            if (!cancelled) setDbStatus("error");
          }
        } catch {
          if (!cancelled) {
            setApiStatus("offline");
            setDbStatus("idle");
          }
        }
      })();
    };
    probe();
    const id = window.setInterval(probe, PERIODIC_HEALTH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const provisional = storedSession;
  const verifying = Boolean(provisional && !verifiedSession && !rejected);
  const displaySession = verifiedSession ?? provisional;

  if (rejected || (!provisional && !displaySession)) {
    return null;
  }

  if (!displaySession) {
    return null;
  }
  async function doLogout() {
    try {
      await api.logout();
    } finally {
      clearAuthSession();
      router.replace("/login");
    }
  }

  const showAdminSidebar = layout === "admin";

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      {showAdminSidebar ? (
      <aside
        data-admin-sidebar
        className="sticky top-0 h-screen w-[260px] shrink-0 overflow-y-auto border-r border-ink/10 bg-surface"
      >
        <div className="flex min-h-full w-[260px] flex-col px-4 pb-5 pt-5">
          <div className="mb-5">
            <h2 className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">Zomate Fitness</h2>
            <div
              className="mt-2 space-y-1 text-[11px] leading-4 text-ink/55"
              title={
                isUsingNextMockApi()
                  ? "NEXT_PUBLIC_USE_NEXT_MOCK_API=1 — mock API"
                  : `${getResolvedApiBaseUrl()} — FastAPI`
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                    apiStatus === "online"
                      ? "bg-emerald-500"
                      : apiStatus === "offline"
                        ? "bg-rose-400"
                        : "bg-amber-400"
                  }`}
                />
                <span>
                  {apiStatus === "online"
                    ? isUsingNextMockApi()
                      ? "API：Next mock"
                      : "API：Working"
                    : apiStatus === "offline"
                      ? "API：離線"
                      : "API：檢查中…"}
                </span>
              </div>
              {apiStatus === "online" && !isUsingNextMockApi() && (dbStatus === "checking" || dbStatus === "ok" || dbStatus === "error") && (
                <div className="flex items-center gap-2 pl-4">
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                      dbStatus === "ok" ? "bg-emerald-500" : dbStatus === "error" ? "bg-rose-400" : "bg-amber-400"
                    }`}
                  />
                  <span
                    className={`text-[10px] leading-snug ${
                      dbStatus === "ok" ? "text-emerald-700" : dbStatus === "error" ? "text-rose-600" : "text-ink/45"
                    }`}
                  >
                    {dbStatus === "checking" ? "PostgreSQL…" : null}
                    {dbStatus === "ok" ? "後台已連線" : null}
                    {dbStatus === "error" ? "DB：無法連線" : null}
                  </span>
                </div>
              )}
            </div>
          </div>
          <nav className="flex-1 space-y-3">
            {MENU_SECTIONS.map((section, si) => (
              <div key={si} className={section.frameClass}>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isNavActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={navLinkClass(active)}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <button
            type="button"
            onClick={doLogout}
            className="mt-4 rounded-lg border border-ink/15 bg-transparent px-3 py-2.5 text-left text-[13px] text-ink/90 transition hover:border-primary/50 hover:bg-canvas/60"
          >
            登出
          </button>
        </div>
      </aside>
      ) : null}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-canvas">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink/10 bg-canvas/95 px-4 py-3 backdrop-blur-md md:px-6">
          <h1 className="min-w-0 flex-1 text-[17px] font-semibold tracking-[-0.02em] text-ink md:text-lg">{title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            {layout === "coach" ? (
              <button
                type="button"
                onClick={() => void doLogout()}
                className="rounded-lg border border-ink/15 bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas"
              >
                登出
              </button>
            ) : null}
            <div
              data-admin-user-badge
              className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-ink/15 bg-surface px-3 text-[12px] text-ink md:text-[13px]"
            >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/90 text-[11px] font-semibold text-ink"
              aria-hidden="true"
            >
              {displaySession.username.slice(0, 1).toUpperCase()}
            </span>
            <span className="max-w-[10rem] truncate whitespace-nowrap md:max-w-none">
              {displaySession.username} ({displaySession.role})
              {verifying ? <span className="text-ink/45"> · 驗證中</span> : null}
            </span>
          </div>
          </div>
        </header>
        <main className={`relative min-w-0 flex-1 overflow-y-auto ${layout === "coach" ? "p-3 sm:p-4" : "p-4 md:p-6"}`}>
          {verifying ? (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-canvas/80 backdrop-blur-[2px]"
              aria-busy="true"
              aria-live="polite"
            >
              <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-primary" />
              <span className="text-sm text-ink/55">驗證登入…</span>
            </div>
          ) : null}
          {children}
        </main>
        <nav data-admin-bottom-nav className="hidden" aria-hidden="true" />
      </div>
    </div>
  );
}
