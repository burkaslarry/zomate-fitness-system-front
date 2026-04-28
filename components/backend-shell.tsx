"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthSession, getAuthSession, type AuthSession } from "../lib/auth";
import { api, getResolvedApiBaseUrl, isUsingNextMockApi } from "../lib/api";
import { PERIODIC_HEALTH_INTERVAL_MS } from "../hooks/use-periodic-health-ping";

/*
 * CF04: Shared backend layout shell.
 * Steps:
 * 01. 驗證登入 session，未登入即導向 /login
 * 02. Top bar 顯示使用者與角色（ADMIN / CLERK）
 * 03. 全尺寸使用單一左側選單（不使用漢堡選單）
 * 04. 每 10 分鐘呼叫 ``GET /api/health`` +（非 mock）``GET /api/health/db``，更新側欄連線狀態。
 *
 * Dark theme tokens (Picolabbs ref.): canvas #121212, border ~12% white,
 * accent #6366f1, success rgb(34,197,94), radii lg≈8px / md≈6px.
 */

const MENU_GROUPS = [
  {
    title: "Dashboard",
    items: [{ href: "/admin", label: "後台面板" }]
  },
  {
    title: "Student Management",
    items: [
      { href: "/admin/students", label: "學生名單" },
      { href: "/admin/onboarding-records", label: "入職紀錄 / 健康表單" }
    ]
  },
    {
      title: "Course & Attendance",
      items: [
        { href: "/admin/course-set", label: "Course 套餐開課" },
        { href: "/coach/calendar", label: "教練日程 · 簽到" },
      { href: "/coach", label: "教練課表" },
      { href: "/admin/attendance/qr-console", label: "QR 簽到中心" },
      { href: "/admin/attendance/session-ledger", label: "Session Ledger" },
      { href: "/student/trial", label: "試堂 / 開課管理" },
      { href: "/student", label: "學生入口" }
    ]
  },
  {
    title: "Finance & Admin",
    items: [
      { href: "/admin/finance/sales", label: "銷售與分期" },
      { href: "/admin/finance/expenses", label: "支出管理" },
      { href: "/admin/finance/payroll", label: "薪酬 / 出勤報表" }
    ]
  },
  {
    title: "System Settings",
    items: [
      { href: "/admin/settings/whatsapp", label: "WhatsApp API 狀態" },
      { href: "/admin/settings/disclaimer", label: "免責聲明內容設定" }
    ]
  }
];

export default function BackendShell({ children, title }: { children: ReactNode; title: string }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [dbStatus, setDbStatus] = useState<"idle" | "checking" | "ok" | "error" | "na">("idle");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const s = getAuthSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
  }, [router]);

  useEffect(() => {
    const saved = window.localStorage.getItem("zomate_theme");
    const initial = saved === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("light", initial === "light");
  }, []);

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

  if (!session) {
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

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("light", next === "light");
    window.localStorage.setItem("zomate_theme", next);
  }

  return (
    <div className={`flex min-h-screen ${theme === "dark" ? "bg-[#121212] text-white" : "bg-[#f1f5f9] text-[#111827]"}`}>
      <aside
        className={`${
          mobileMenuOpen ? "fixed inset-y-0 left-0 z-50" : "hidden"
        } w-[260px] shrink-0 border-r md:relative md:z-auto md:block ${
          theme === "dark"
            ? "border-white/[0.12] bg-[#121212]"
            : "border-slate-300/60 bg-white"
        }`}
      >
        <div className="flex h-full w-[260px] flex-col px-4 pb-5 pt-5">
          <div className="mb-6">
            <h2 className="mt-1 text-[15px] font-semibold leading-[1.28] tracking-[-0.01em]">
              <span className="block">Zomate Fitness System</span>
              <span className="block">Admin Console</span>
            </h2>
            <div
              className="mt-2.5 space-y-1 text-[11px] leading-4 text-zinc-400/95"
              title={
                isUsingNextMockApi()
                  ? "NEXT_PUBLIC_USE_NEXT_MOCK_API=1 — 使用 Next 內建 mock。正式資料請設 NEXT_PUBLIC_API_BASE_URL 並於後端設定 DATABASE_URL（eventxp / zomate_fs_*）。"
                  : `${getResolvedApiBaseUrl()} — FastAPI → PostgreSQL（zomate_fs_*，由 zomate-fitness-system-back 的 DATABASE_URL 連線）`
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                    apiStatus === "online"
                      ? "bg-[rgb(34,197,94)]"
                      : apiStatus === "offline"
                        ? "bg-rose-400"
                        : "bg-amber-300"
                  }`}
                />
                <span>
                  {apiStatus === "online"
                    ? isUsingNextMockApi()
                      ? "API：Next mock"
                      : "API：FastAPI"
                    : apiStatus === "offline"
                      ? "API：離線"
                      : "API：檢查中…"}
                </span>
              </div>
              {apiStatus === "online" && !isUsingNextMockApi() && (dbStatus === "checking" || dbStatus === "ok" || dbStatus === "error") && (
                <div className="flex items-center gap-2 pl-4">
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                      dbStatus === "ok"
                        ? "bg-[rgb(34,197,94)]"
                        : dbStatus === "error"
                          ? "bg-rose-400"
                          : "bg-amber-300"
                    }`}
                  />
                  <span className="text-[10px] leading-snug text-zinc-500">
                    {dbStatus === "checking" ? "PostgreSQL…" : null}
                    {dbStatus === "ok" ? "DB：eventxp · zomate_fs_* 已連線" : null}
                    {dbStatus === "error" ? "DB：無法連線（檢查後端 DATABASE_URL）" : null}
                  </span>
                </div>
              )}
            </div>
          </div>
          <nav className="flex-1 space-y-4.5">
            {MENU_GROUPS.map((group) => (
              <div key={group.title} className="space-y-0.5">
                <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase leading-4 tracking-[0.14em] text-zinc-500/90">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const isActive =
                    item.href === "/coach"
                      ? pathname === "/coach"
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg border-l-[3px] border-transparent px-2.5 py-2 text-[13px] leading-5 transition ${
                        isActive
                          ? theme === "dark"
                            ? "border-[#6366f1] bg-white/[0.07] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
                            : "border-slate-600/90 bg-slate-100/90 text-slate-900"
                          : theme === "dark"
                            ? "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                            : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <button
            type="button"
            onClick={doLogout}
            className={`mt-3 rounded-lg border px-3 py-2.5 text-left text-[13px] leading-5 transition ${
              theme === "dark"
                ? "border-white/[0.12] bg-transparent text-zinc-200 hover:border-[#6366f1]/55 hover:bg-white/[0.03] hover:text-white"
                : "border-slate-300/70 text-slate-700 hover:border-slate-400 hover:text-slate-900"
            }`}
          >
            登出
          </button>
        </div>
      </aside>
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="關閉選單"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className={`flex min-h-screen min-w-0 flex-1 flex-col ${theme === "dark" ? "bg-[#121212]" : "bg-[#f8fafc]"}`}>
        <header
          className={`sticky top-0 z-30 border-b px-4 py-2.5 backdrop-blur-md md:px-6 md:py-3 ${
            theme === "dark"
              ? "border-white/[0.12] bg-[#121212]/92"
              : "border-slate-200/80 bg-white/[0.92]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div>
              <p className={`text-[11px] font-medium uppercase leading-4 tracking-[0.06em] ${theme === "dark" ? "text-zinc-400/95" : "text-slate-500"}`}>
                Dashboard / {title}
              </p>
              <h1
                className={`mt-0.5 text-[17px] font-semibold leading-tight tracking-[-0.02em] md:text-lg ${theme === "dark" ? "text-white" : "text-slate-900"}`}
              >
                {title}
              </h1>
            </div>
            <div className="ml-auto hidden items-center gap-2.5 md:flex">
              <input
                placeholder="搜尋..."
                className={`h-9 w-52 rounded-lg border px-3 text-[13px] leading-normal shadow-sm ${
                  theme === "dark"
                    ? "border-white/[0.12] bg-[#1e1e1e] text-zinc-100 placeholder:text-zinc-500"
                    : "border-slate-300/80 bg-white text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                }`}
              />
              <button
                type="button"
                onClick={toggleTheme}
                className={`h-9 rounded-lg border bg-transparent px-2.5 text-[12px] leading-none ${
                  theme === "dark"
                    ? "border-white/[0.12] text-white hover:border-white/[0.22]"
                    : "border-slate-300/90 text-slate-700 hover:border-slate-400 hover:text-slate-900"
                }`}
                aria-label="切換模式"
              >
                {theme === "dark" ? "☀" : "☾"}
              </button>
              <div className={`text-[12px] leading-5 md:text-[13px] ${theme === "dark" ? "text-zinc-300" : "text-slate-600"}`}>
                {session.username} ({session.role})
              </div>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">{children}</main>
        <nav
          className={`fixed bottom-0 left-0 right-0 z-30 border-t px-3 py-2 md:hidden ${
            theme === "dark" ? "border-white/[0.12] bg-[#121212]/95" : "border-slate-200/80 bg-white/[0.95]"
          }`}
        >
          <div className="grid grid-cols-3 gap-2">
            <Link
              href="/student/checkin"
              className={`rounded-lg px-3 py-2 text-center text-xs ${
                pathname.startsWith("/student/checkin")
                  ? theme === "dark"
                    ? "bg-[#6366f1] text-white"
                    : "bg-slate-200 text-slate-900"
                  : theme === "dark"
                    ? "text-zinc-300 hover:bg-white/[0.05]"
                    : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              簽到
            </Link>
            <Link
              href="/admin/students"
              className={`rounded-lg px-3 py-2 text-center text-xs ${
                pathname.startsWith("/admin/students")
                  ? theme === "dark"
                    ? "bg-[#6366f1] text-white"
                    : "bg-slate-200 text-slate-900"
                  : theme === "dark"
                    ? "text-zinc-300 hover:bg-white/[0.05]"
                    : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              搜尋
            </Link>
            <Link
              href="/admin"
              className={`rounded-lg px-3 py-2 text-center text-xs ${
                pathname === "/admin"
                  ? theme === "dark"
                    ? "bg-[#6366f1] text-white"
                    : "bg-slate-200 text-slate-900"
                  : theme === "dark"
                    ? "text-zinc-300 hover:bg-white/[0.05]"
                    : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Dashboard
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
