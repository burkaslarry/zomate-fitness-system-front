"use client";

/**
 * [F007][S003]
 * Feature: Access Rights (Excel matrix)
 * Step: Master admin system account CRUD — masterzoe / masterfung only
 * Logic: Add clerk/coach logins, set password, disable accounts; display permission matrix.
 */

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackendShell from "../../../components/backend-shell";
import { alertApiError, api } from "../../../lib/api";
import { getAuthSession, mergeAuthSessionFromMe, setAuthSession } from "../../../lib/auth";

type MatrixRow = {
  key: string;
  label_zh: string;
  href: string;
  remark?: string | null;
  matrix: Record<string, boolean>;
};

type SystemUser = {
  id: number;
  username: string;
  role: string;
  access_role: string;
  is_master_admin: boolean;
  is_active: boolean;
  coach_id: number | null;
  created_at: string;
};

type CoachOption = { id: number; full_name: string };

export default function SystemUsersPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"CLERK" | "COACH">("CLERK");
  const [coachId, setCoachId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const reload = useCallback(async () => {
    const [m, u, c] = await Promise.all([
      api.accessRightsMatrix() as Promise<{ rows: MatrixRow[] }>,
      api.listSystemUsers() as Promise<SystemUser[]>,
      api.publicCoaches() as Promise<CoachOption[]>
    ]);
    setMatrix(m.rows ?? []);
    setUsers(Array.isArray(u) ? u : []);
    setCoaches(Array.isArray(c) ? c.filter((x) => x && "id" in x) : []);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const me = (await api.me()) as Parameters<typeof mergeAuthSessionFromMe>[1];
        const base = getAuthSession();
        if (base) setAuthSession(mergeAuthSessionFromMe(base, me));
        if (!me.is_master_admin) {
          setAllowed(false);
          router.replace("/admin");
          return;
        }
        setAllowed(true);
        await reload();
      } catch {
        setAllowed(false);
        router.replace("/login");
      }
    })();
  }, [reload, router]);

  async function onCreate(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setToast("");
    try {
      await api.createSystemUser({
        username: username.trim().toLowerCase(),
        password,
        role,
        coach_id: role === "COACH" && coachId ? Number(coachId) : undefined
      });
      setUsername("");
      setPassword("");
      setCoachId("");
      setToast("已建立帳號，對方可以登入開波。");
      await reload();
    } catch (e) {
      alertApiError(e);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(userId: number, name: string) {
    const next = window.prompt(`設定新密碼 · ${name}`, "");
    if (!next || next.length < 6) return;
    setBusy(true);
    try {
      await api.updateSystemUser(userId, { password: next });
      setToast(`已更新 ${name} 密碼`);
      await reload();
    } catch (e) {
      alertApiError(e);
    } finally {
      setBusy(false);
    }
  }

  async function disableUser(userId: number, name: string) {
    if (!window.confirm(`停用帳號「${name}」？對方將無法登入。`)) return;
    setBusy(true);
    try {
      await api.deleteSystemUser(userId);
      setToast(`已停用 ${name}`);
      await reload();
    } catch (e) {
      alertApiError(e);
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) {
    return (
      <BackendShell title="系統帳號">
        <p className="text-sm text-ink/60">載入中…</p>
      </BackendShell>
    );
  }

  if (!allowed) return null;

  return (
    <BackendShell title="系統帳號 · Access Rights">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-semibold">可以開波</p>
          <p className="mt-1 text-emerald-900/90">
            以 masterzoe / masterfung 登入後，在此建立櫃台（clerk）或教練（PT）帳號並設定密碼，即可開始營運。權限表依{" "}
            <code className="text-xs">docs/access-rights-matrix.xlsx</code>。
          </p>
        </div>

        {toast ? (
          <p className="rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink">{toast}</p>
        ) : null}

        <section className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Access Rights 表</h2>
          <p className="mt-1 text-xs text-ink/55">Masteradmin · PT · clerk（來源 Excel）</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-ink/10 text-ink/70">
                  <th className="px-2 py-2 font-medium">功能</th>
                  <th className="px-2 py-2 font-medium">Masteradmin</th>
                  <th className="px-2 py-2 font-medium">PT</th>
                  <th className="px-2 py-2 font-medium">clerk</th>
                  <th className="px-2 py-2 font-medium">備註</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.key} className="border-b border-ink/5">
                    <td className="px-2 py-2 font-medium text-ink">{row.label_zh}</td>
                    <td className="px-2 py-2">{row.matrix.Masteradmin ? "✓" : "—"}</td>
                    <td className="px-2 py-2">{row.matrix.PT ? "✓" : "—"}</td>
                    <td className="px-2 py-2">{row.matrix.clerk ? "✓" : "—"}</td>
                    <td className="max-w-xs px-2 py-2 text-ink/55">{row.remark ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">新增系統帳號</h2>
          <form onSubmit={onCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-ink/70">登入帳號</span>
              <input
                className="mt-1 w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="coachfunglo"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink/70">密碼（最少 6 字）</span>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink/70">角色</span>
              <select
                className="mt-1 w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2"
                value={role}
                onChange={(e) => setRole(e.target.value as "CLERK" | "COACH")}
              >
                <option value="CLERK">clerk（櫃台）</option>
                <option value="COACH">PT（教練）</option>
              </select>
            </label>
            {role === "COACH" ? (
              <label className="block text-sm">
                <span className="text-ink/70">綁定教練</span>
                <select
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2"
                  value={coachId}
                  onChange={(e) => setCoachId(e.target.value ? Number(e.target.value) : "")}
                  required
                >
                  <option value="">請選擇</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-primary/90 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {busy ? "處理中…" : "建立帳號"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">帳號列表</h2>
          <ul className="mt-4 space-y-2">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-ink">{u.username}</span>
                  <span className="ml-2 text-xs text-ink/55">
                    {u.access_role}
                    {!u.is_active ? " · 已停用" : ""}
                    {u.is_master_admin ? " · Master" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || u.is_master_admin}
                    className="rounded border border-ink/15 px-2 py-1 text-xs disabled:opacity-40"
                    onClick={() => void resetPassword(u.id, u.username)}
                  >
                    重設密碼
                  </button>
                  <button
                    type="button"
                    disabled={busy || u.is_master_admin || !u.is_active}
                    className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-800 disabled:opacity-40"
                    onClick={() => void disableUser(u.id, u.username)}
                  >
                    停用
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </BackendShell>
  );
}
