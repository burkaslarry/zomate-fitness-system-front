"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuthSession, getAuthSession, type AuthSession } from "../lib/auth";
import { api } from "../lib/api";

/*
 * CF04: Shared backend layout shell.
 * Steps:
 * 01. 驗證登入 session，未登入即導向 /login
 * 02. Top bar 顯示使用者與角色（ADMIN / CLERK）
 * 03. 桌機顯示側邊選單，行動版提供漢堡選單
 */

const MENU = [
  { href: "/admin", label: "後台面板" },
  { href: "/coach", label: "教練課表" },
  { href: "/student", label: "學生入口" },
];

export default function BackendShell({ children, title }: { children: ReactNode; title: string }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const s = getAuthSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
  }, [router]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const syncMenu = (event?: MediaQueryListEvent) => {
      const matches = event ? event.matches : media.matches;
      setIsDesktop(matches);
      setOpen(matches);
    };

    syncMenu();
    media.addEventListener("change", syncMenu);
    return () => media.removeEventListener("change", syncMenu);
  }, []);

  function closeMobileMenu() {
    if (!isDesktop) {
      setOpen(false);
    }
  }

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

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-3 py-3 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="打開選單">
              ☰
            </button>
            <div className="font-medium">{title}</div>
          </div>
          <div className="text-sm">
            Login: {session.username} · {session.role}
          </div>
          <button type="button" onClick={doLogout} className="rounded border px-2 py-1 text-sm">
            登出
          </button>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-4 overflow-hidden p-4 md:p-6">
        <aside
          className={`${open ? "fixed inset-0 z-30 bg-black/40 p-0" : "hidden"} md:relative md:block md:bg-transparent md:p-0`}
          onClick={closeMobileMenu}
        >
          <div
            className={`h-full w-64 bg-white p-4 shadow-md md:static ${
              open ? "h-full" : "h-auto"
            } md:h-auto md:w-56`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              <p className="text-xs uppercase text-slate-500">menu</p>
              {MENU.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded border border-slate-200 bg-white p-2 text-sm"
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
