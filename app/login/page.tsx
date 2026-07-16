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
        <p className="text-sm text-black">
          預設帳號：masterzoe / 12345678（ADMIN），worker / 12347890（CLERK），coachdemo / 12347890（COACH·僅教練日程）
        </p>
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
      </div>
      <BuildFooter className="pb-4" />
    </main>
  );
}
