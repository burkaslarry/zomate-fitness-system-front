"use client";

/**
 * [F007][S003]
 * Feature: Access Rights (Excel matrix)
 * Step: Master admin system account CRUD + per-user permission tick boxes
 * Logic: Two-column checkbox grid; create form revealed by + 新增 button.
 */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BackendShell from "../../../components/backend-shell";
import { alertApiError, api } from "../../../lib/api";
import { getAuthSession, mergeAuthSessionFromMe, setAuthSession } from "../../../lib/auth";
import {
  EDITABLE_ACCESS_FEATURES,
  labelForPermissionKey,
  permissionsForRole,
  type AccessFeature,
  type AccessRole
} from "../../../lib/access-rights";

type SystemUser = {
  id: number;
  username: string;
  role: string;
  access_role: string;
  is_master_admin: boolean;
  is_active: boolean;
  coach_id: number | null;
  permissions: string[];
  uses_custom_permissions: boolean;
  created_at: string;
};

type CoachOption = { id: number; full_name: string };

type ConfirmState = {
  userId: number;
  username: string;
  before: string[];
  after: string[];
};

function permissionDiff(before: string[], after: string[]) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((k) => !beforeSet.has(k)),
    removed: before.filter((k) => !afterSet.has(k))
  };
}

function splitFeatureColumns(features: AccessFeature[]): [AccessFeature[], AccessFeature[]] {
  const mid = Math.ceil(features.length / 2);
  return [features.slice(0, mid), features.slice(mid)];
}

function PermissionCheckboxGrid({
  values,
  disabled,
  onToggle
}: {
  values: string[];
  disabled?: boolean;
  onToggle: (key: string, checked: boolean) => void;
}) {
  const [left, right] = useMemo(() => splitFeatureColumns(EDITABLE_ACCESS_FEATURES), []);

  const renderColumn = (items: AccessFeature[]) => (
    <div className="space-y-2">
      {items.map((feat) => (
        <label key={feat.key} className="flex cursor-pointer items-center gap-2.5 text-sm leading-snug text-ink">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border-ink/25"
            checked={values.includes(feat.key)}
            disabled={disabled}
            onChange={(e) => onToggle(feat.key, e.target.checked)}
          />
          <span>{feat.label_zh}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
      {renderColumn(left)}
      {renderColumn(right)}
    </div>
  );
}

export default function SystemUsersPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"CLERK" | "COACH">("CLERK");
  const [coachId, setCoachId] = useState<number | "">("");
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>(() =>
    permissionsForRole("CLERK")
  );
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<Record<number, string[]>>({});
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const reload = useCallback(async () => {
    const [u, c] = await Promise.all([
      api.listSystemUsers() as Promise<SystemUser[]>,
      api.publicCoaches() as Promise<CoachOption[]>
    ]);
    const list = Array.isArray(u) ? u : [];
    setUsers(list);
    setDraftPermissions(Object.fromEntries(list.map((row) => [row.id, row.permissions ?? []])));
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

  function togglePermission(userId: number, key: string, checked: boolean) {
    setDraftPermissions((prev) => {
      const current = new Set(prev[userId] ?? []);
      if (checked) current.add(key);
      else current.delete(key);
      return { ...prev, [userId]: [...current] };
    });
  }

  function toggleNewUserPermission(key: string, checked: boolean) {
    setNewUserPermissions((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return [...next];
    });
  }

  function onRoleChange(next: "CLERK" | "COACH") {
    setRole(next);
    setNewUserPermissions(permissionsForRole(next));
    if (next === "CLERK") setCoachId("");
  }

  function resetCreateForm() {
    setShowCreateForm(false);
    setUsername("");
    setPassword("");
    setRole("CLERK");
    setCoachId("");
    setNewUserPermissions(permissionsForRole("CLERK"));
  }

  function openConfirmSave(user: SystemUser) {
    const before = user.permissions ?? [];
    const after = draftPermissions[user.id] ?? before;
    if (before.slice().sort().join(",") === after.slice().sort().join(",")) {
      setToast(`${user.username} 權限未有變更`);
      return;
    }
    setConfirm({ userId: user.id, username: user.username, before, after });
  }

  async function applyPermissionSave() {
    if (!confirm) return;
    setBusy(true);
    setToast("");
    try {
      await api.updateSystemUser(confirm.userId, { permissions: confirm.after });
      setToast(`已更新 ${confirm.username} 的 Access Rights`);
      setConfirm(null);
      setExpandedUserId(null);
      await reload();
    } catch (e) {
      alertApiError(e);
    } finally {
      setBusy(false);
    }
  }

  async function resetToRoleDefaults(user: SystemUser) {
    if (!window.confirm(`將「${user.username}」權限重設為 ${user.access_role} 角色預設？`)) return;
    setBusy(true);
    try {
      await api.updateSystemUser(user.id, { reset_permissions: true });
      setToast(`已重設 ${user.username} 為角色預設權限`);
      await reload();
    } catch (e) {
      alertApiError(e);
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setToast("");
    try {
      await api.createSystemUser({
        username: username.trim().toLowerCase(),
        password,
        role,
        coach_id: role === "COACH" && coachId ? Number(coachId) : undefined,
        permissions: newUserPermissions
      });
      resetCreateForm();
      setToast("已建立帳號");
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

  const confirmDiff = confirm ? permissionDiff(confirm.before, confirm.after) : null;

  return (
    <BackendShell title="系統帳號 · Access Rights">
      <div className="mx-auto max-w-5xl space-y-6">
        {toast ? (
          <p className="rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink">{toast}</p>
        ) : null}

        <section className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm">
          {!showCreateForm ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-primary/90 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
              onClick={() => setShowCreateForm(true)}
            >
              + 新增系統帳號
            </button>
          ) : (
            <form onSubmit={onCreate} className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">新增系統帳號</h2>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs text-ink/55 underline-offset-2 hover:underline"
                  onClick={resetCreateForm}
                >
                  取消
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
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
                    onChange={(e) => onRoleChange(e.target.value as "CLERK" | "COACH")}
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
              </div>
              <div>
                <h3 className="text-sm font-medium text-ink">Access Rights</h3>
                <p className="mt-1 text-xs text-ink/55">勾選此帳號可使用的功能（預設跟隨角色）</p>
                <div className="mt-3 rounded-lg border border-ink/10 bg-canvas p-4">
                  <PermissionCheckboxGrid
                    values={newUserPermissions}
                    disabled={busy}
                    onToggle={toggleNewUserPermission}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-primary/90 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {busy ? "處理中…" : "建立帳號"}
              </button>
            </form>
          )}
        </section>

        <section className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">帳號列表 · 修改權限</h2>
          <ul className="mt-4 space-y-3">
            {users.map((u) => {
              const expanded = expandedUserId === u.id;
              const draft = draftPermissions[u.id] ?? u.permissions ?? [];
              const roleDefaults = permissionsForRole(u.access_role as AccessRole);
              return (
                <li key={u.id} className="rounded-lg border border-ink/10 bg-canvas">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-ink">{u.username}</span>
                      <span className="ml-2 text-xs text-ink/55">
                        {u.access_role}
                        {!u.is_active ? " · 已停用" : ""}
                        {u.is_master_admin ? " · Master" : ""}
                        {u.uses_custom_permissions ? " · 自訂權限" : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!u.is_master_admin && u.is_active ? (
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded border border-primary/30 px-2 py-1 text-xs text-ink"
                          onClick={() => setExpandedUserId(expanded ? null : u.id)}
                        >
                          {expanded ? "收合權限" : "修改權限"}
                        </button>
                      ) : null}
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
                  </div>
                  {expanded && !u.is_master_admin ? (
                    <div className="border-t border-ink/10 px-3 py-3">
                      <p className="text-xs text-ink/55">
                        角色預設（{u.access_role}）：{roleDefaults.map(labelForPermissionKey).join("、")}
                      </p>
                      <div className="mt-3 rounded-lg border border-ink/10 bg-surface p-4">
                        <PermissionCheckboxGrid
                          values={draft}
                          disabled={busy}
                          onToggle={(key, checked) => togglePermission(u.id, key, checked)}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-lg bg-primary/90 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                          onClick={() => openConfirmSave(u)}
                        >
                          儲存權限
                        </button>
                        {u.uses_custom_permissions ? (
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs text-ink disabled:opacity-50"
                            onClick={() => void resetToRoleDefaults(u)}
                          >
                            重設為角色預設
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {confirm && confirmDiff ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => !busy && setConfirm(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-ink/10 bg-surface p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="perm-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="perm-confirm-title" className="text-lg font-semibold text-ink">
              確認修改 Access Rights
            </h2>
            <p className="mt-2 text-sm text-ink/70">
              帳號：<strong>{confirm.username}</strong>
            </p>
            {confirmDiff.added.length ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-emerald-800">新增權限</p>
                <ul className="mt-1 list-inside list-disc text-sm text-ink">
                  {confirmDiff.added.map((k) => (
                    <li key={k}>{labelForPermissionKey(k)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {confirmDiff.removed.length ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-rose-800">移除權限</p>
                <ul className="mt-1 list-inside list-disc text-sm text-ink">
                  {confirmDiff.removed.map((k) => (
                    <li key={k}>{labelForPermissionKey(k)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {!confirmDiff.added.length && !confirmDiff.removed.length ? (
              <p className="mt-3 text-sm text-ink/60">未有變更</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
                onClick={() => setConfirm(null)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-primary/90 px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
                onClick={() => void applyPermissionSave()}
              >
                {busy ? "儲存中…" : "確認儲存"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </BackendShell>
  );
}
