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
    <div className="flex min-h-screen bg-[#121212] text-white">
      <aside
        className={`${open ? "fixed inset-0 z-40 bg-black/70 p-0" : "hidden"} md:relative md:block md:w-64 md:bg-[#121212]`}
        onClick={closeMobileMenu}
      >
        <div
          className="h-full w-72 border-r border-[#262626] bg-[#121212] p-5 md:w-64"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[#7c3aed]">Zomate</p>
            <h2 className="mt-2 text-lg font-semibold">Admin Console</h2>
          </div>
          <nav className="space-y-1">
            {MENU.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    isActive
                      ? "border-l-2 border-[#7c3aed] bg-[#1f1f1f] text-white"
                      : "text-[#a0a0a0] hover:bg-[#1a1a1a] hover:text-white"
                  }`}
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-[#1a1a1a]">
        <header className="sticky top-0 z-30 border-b border-[#2b2b2b] bg-[#1a1a1a]/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="打開選單">
              ☰
            </button>
            <div>
              <p className="text-xs uppercase tracking-wider text-[#a0a0a0]">Dashboard / {title}</p>
              <h1 className="text-base font-semibold text-white md:text-lg">{title}</h1>
            </div>
            <div className="ml-auto text-right text-xs text-[#a0a0a0] md:text-sm">
              <div>Login: {session.username} · {session.role}</div>
            </div>
            <button
              type="button"
              onClick={doLogout}
              className="ml-3 rounded-md border border-[#3a3a3a] px-3 py-1.5 text-xs text-[#d4d4d4] hover:border-[#7c3aed] hover:text-white md:text-sm"
            >
              登出
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
