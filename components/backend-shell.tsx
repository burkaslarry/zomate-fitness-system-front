"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthSession, getAuthSession, type AuthSession } from "../lib/auth";
import { api } from "../lib/api";

/*
 * CF04: Shared backend layout shell.
 * Steps:
 * 01. 驗證登入 session，未登入即導向 /login
 * 02. Top bar 顯示使用者與角色（ADMIN / CLERK）
 * 03. 全尺寸使用單一左側選單（不使用漢堡選單）
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
      { href: "/coach", label: "教練課表" },
      { href: "/admin/attendance/qr-console", label: "QR 簽到中心" },
      { href: "/student/trial", label: "試堂 / 開課管理" }
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
    api
      .health()
      .then(() => {
        if (!cancelled) setApiStatus("online");
      })
      .catch(() => {
        if (!cancelled) setApiStatus("offline");
      });
    return () => {
      cancelled = true;
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
    <div className={`flex min-h-screen ${theme === "dark" ? "bg-[#121212] text-white" : "bg-[#f3f4f6] text-[#111827]"}`}>
      <aside
        className={`${
          mobileMenuOpen ? "fixed inset-y-0 left-0 z-50" : "hidden"
        } w-64 shrink-0 border-r md:relative md:z-auto md:block ${
          theme === "dark" ? "border-[#262626] bg-[#121212]" : "border-slate-200 bg-white"
        }`}
      >
        <div className="h-full w-64 p-5">
          <div className="mb-8">
            <h2 className="mt-2 text-lg font-semibold leading-tight">
              <span className="block">Zomate Fitness System</span>
              <span className="block">Admin Console</span>
            </h2>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  apiStatus === "online"
                    ? "bg-emerald-400"
                    : apiStatus === "offline"
                      ? "bg-rose-400"
                      : "bg-amber-300"
                }`}
              />
              WhatsApp/API {apiStatus === "online" ? "Connected" : apiStatus === "offline" ? "Disconnected" : "Checking"}
            </div>
          </div>
          <nav className="space-y-4">
            {MENU_GROUPS.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="px-2 text-[11px] uppercase tracking-wider text-slate-500">{group.title}</p>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                        isActive
                          ? theme === "dark"
                            ? "border-l-2 border-slate-300 bg-[#1f1f1f] text-white"
                            : "border-l-2 border-slate-500 bg-slate-100 text-slate-900"
                          : theme === "dark"
                            ? "text-[#a0a0a0] hover:bg-[#1a1a1a] hover:text-white"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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

      <div className={`flex min-h-screen min-w-0 flex-1 flex-col ${theme === "dark" ? "bg-[#1a1a1a]" : "bg-[#f8fafc]"}`}>
        <header
          className={`sticky top-0 z-30 border-b px-4 py-3 backdrop-blur md:px-6 ${
            theme === "dark" ? "border-[#2b2b2b] bg-[#1a1a1a]/95" : "border-slate-200 bg-white/95"
          }`}
        >
          <div className="flex items-center gap-3">
            
            <div>
              <p className={`text-xs uppercase tracking-wider ${theme === "dark" ? "text-[#a0a0a0]" : "text-slate-500"}`}>Dashboard / {title}</p>
              <h1 className={`text-base font-semibold md:text-lg ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{title}</h1>
            </div>
            <div className={`ml-auto flex items-center gap-2 text-right text-xs md:text-sm ${theme === "dark" ? "text-[#a0a0a0]" : "text-slate-600"}`}>
              <button
                type="button"
                onClick={toggleTheme}
                className={`rounded-md border bg-transparent px-2 py-1 text-xs ${
                  theme === "dark"
                    ? "border-[#3a3a3a] text-white hover:border-slate-200 hover:text-white"
                    : "border-slate-300 text-slate-700 hover:border-slate-500 hover:text-slate-900"
                }`}
              >
                {theme === "dark" ? "Light" : "Dark"}
              </button>
              <div>Login: {session.username} · {session.role}</div>
            </div>
            <button
              type="button"
              onClick={doLogout}
              className={`ml-3 rounded-md border px-3 py-1.5 text-xs md:text-sm ${
                theme === "dark"
                  ? "border-[#3a3a3a] text-[#d4d4d4] hover:border-slate-200 hover:text-white"
                  : "border-slate-300 text-slate-700 hover:border-slate-500 hover:text-slate-900"
              }`}
            >
              登出
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">{children}</main>
        <nav
          className={`fixed bottom-0 left-0 right-0 z-30 border-t px-3 py-2 md:hidden ${
            theme === "dark" ? "border-[#2b2b2b] bg-[#111111]/95" : "border-slate-200 bg-white/95"
          }`}
        >
          <div className="grid grid-cols-3 gap-2">
            <Link
              href="/student/checkin"
              className={`rounded-md px-3 py-2 text-center text-xs ${
                pathname.startsWith("/student/checkin")
                  ? theme === "dark"
                    ? "bg-[#a855f7] text-white"
                    : "bg-slate-200 text-slate-900"
                  : theme === "dark"
                    ? "text-slate-200 hover:bg-[#1b1b1b]"
                    : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              簽到
            </Link>
            <Link
              href="/admin/students"
              className={`rounded-md px-3 py-2 text-center text-xs ${
                pathname.startsWith("/admin/students")
                  ? theme === "dark"
                    ? "bg-[#a855f7] text-white"
                    : "bg-slate-200 text-slate-900"
                  : theme === "dark"
                    ? "text-slate-200 hover:bg-[#1b1b1b]"
                    : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              搜尋
            </Link>
            <Link
              href="/admin"
              className={`rounded-md px-3 py-2 text-center text-xs ${
                pathname === "/admin"
                  ? theme === "dark"
                    ? "bg-[#a855f7] text-white"
                    : "bg-slate-200 text-slate-900"
                  : theme === "dark"
                    ? "text-slate-200 hover:bg-[#1b1b1b]"
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
