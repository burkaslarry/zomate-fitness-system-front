"use client";

/**
 * [F006][S002]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: Staff login page; stores Bearer session in localStorage.
 */

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePeriodicHealthPing } from "../../hooks/use-periodic-health-ping";
import { api } from "../../lib/api";
import BuildFooter from "../../components/build-footer";
import { clearAuthSession, getAuthSession, setAuthSession } from "../../lib/auth";

export default function LoginPage() {
  usePeriodicHealthPing();
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("logout") === "1" || sp.get("clear") === "1") {
      clearAuthSession();
      window.history.replaceState({}, "", "/login");
    }
    const existing = getAuthSession();
    if (existing) {
      router.push(existing.role === "COACH" ? "/coach-portal" : "/admin");
    }
  }, [router]);

  const [username, setUsername] = useState("masterzoe");
  const [password, setPassword] = useState("12345678");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLoginHelp, setShowLoginHelp] = useState(false);

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setLoading(true);
    setError("");
    try {
      clearAuthSession();
      const data = (await api.login({ username: username.trim(), password })) as {
        token: string;
        username: string;
        role: "ADMIN" | "CLERK" | "COACH";
      };
      const role: "ADMIN" | "CLERK" | "COACH" =
        data.role === "ADMIN" || data.role === "CLERK" || data.role === "COACH" ? data.role : "CLERK";
      setAuthSession({
        token: data.token,
        username: data.username,
        role
      });
      router.push(role === "COACH" ? "/coach-portal" : "/admin");
    } catch (err) {
      setError((err as Error).message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-white">
      <div className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-black">後台登入</h1>
        <button
          type="button"
          onClick={() => setShowLoginHelp(true)}
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          如何登入？
        </button>
        <div className="space-y-2">
          <label className="text-sm text-black">
            帳號
            <input
              className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-black"
              value={username}
              onChange={(ev) => setUsername(ev.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="text-sm text-black">
            密碼
            <input
              className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-black"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
        </div>
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="w-full">
          {loading ? "登入中..." : "登入"}
        </button>
      </form>
      {showLoginHelp ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setShowLoginHelp(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="login-help-title" className="text-lg font-semibold text-black">
                如何登入？
              </h2>
              <button
                type="button"
                onClick={() => setShowLoginHelp(false)}
                className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-black"
                aria-label="關閉"
              >
                ✕
              </button>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-black">
              <li>
                <strong>masterzoe</strong> / 12345678（ADMIN）
              </li>
              <li>
                <strong>worker</strong> / 12347890（CLERK）
              </li>
              <li>
                <strong>coachdemo</strong> / 12347890（COACH·僅教練日程）
              </li>
              <li>
                <strong>funglo</strong> / 12345666（教練）
              </li>
            </ul>
            <p className="mt-4 text-xs font-medium text-amber-800">（切勿公開，只限 DEMO）</p>
            <button
              type="button"
              onClick={() => setShowLoginHelp(false)}
              className="mt-4 w-full rounded-lg border border-slate-300 bg-slate-50 py-2 text-sm font-medium text-black hover:bg-slate-100"
            >
              關閉
            </button>
          </div>
        </div>
      ) : null}
      </div>
      <BuildFooter className="pb-4" />
    </main>
  );
}
