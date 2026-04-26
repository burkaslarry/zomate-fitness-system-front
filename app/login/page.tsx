"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { clearAuthSession, getAuthSession, setAuthSession } from "../../lib/auth";

/*
 * CF05: Login flow.
 * Steps:
 * 01. 檢查既有 session，有則直接轉跳後台
 * 02. 呼叫 /api/auth/login 取得 token
 * 03. 將 token 與角色存到 localStorage 後，導向 /admin
 */

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => {
    const existing = getAuthSession();
    if (existing) {
      router.push("/admin");
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
        role: "ADMIN" | "CLERK";
      };
      setAuthSession({
        token: data.token,
        username: data.username,
        role: data.role === "ADMIN" ? "ADMIN" : "CLERK"
      });
      router.push(data.role === "ADMIN" ? "/admin" : "/admin");
    } catch (err) {
      setError((err as Error).message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full space-y-4 rounded-lg border bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">後台登入</h1>
        <p className="text-sm text-slate-600">預設帳號：masterzoe / 12345678（ADMIN），worker / 12347890（CLERK）</p>
        <div className="space-y-2">
          <label className="text-sm">
            帳號
            <input
              className="mt-1 w-full rounded border p-2"
              value={username}
              onChange={(ev) => setUsername(ev.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="text-sm">
            密碼
            <input
              className="mt-1 w-full rounded border p-2"
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
    </main>
  );
}
