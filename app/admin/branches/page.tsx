"use client";

/**
 * [F002][S001]
 * Feature: Course Entry & Automation
 * Step: Admin-only branch CRUD (display name · code · address)
 * Logic: Default seeds TST / SW; course categories remain on same page.
 */

import { FormEvent, useCallback, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { alertApiError, api, downloadCsv } from "../../../lib/api";
import { getAuthSession } from "../../../lib/auth";
import type { BranchDto, CourseCategoryDto } from "../../../types/api";

type BranchForm = {
  name: string;
  code: string;
  address: string;
};

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [categories, setCategories] = useState<CourseCategoryDto[]>([]);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<BranchDto | null>(null);
  const [editForm, setEditForm] = useState<BranchForm | null>(null);
  const isAdmin = getAuthSession()?.role === "ADMIN";

  const reloadBranches = useCallback(() => {
    api
      .branches()
      .then((data) => setBranches(Array.isArray(data) ? (data as BranchDto[]) : []))
      .catch((e) => alertApiError(e));
  }, []);

  const reloadCategories = useCallback(() => {
    api
      .courseCategories(true)
      .then((data) => setCategories(Array.isArray(data) ? (data as CourseCategoryDto[]) : []))
      .catch((e) => alertApiError(e));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    reloadBranches();
    reloadCategories();
  }, [isAdmin, reloadBranches, reloadCategories]);

  async function onCreateBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const code = String(form.get("code") ?? "").trim().toUpperCase();
    const address = String(form.get("address") ?? "").trim();
    if (!name || !code || !address) {
      setStatus("請填寫分店名稱、代碼及地址。");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      await api.createBranch({ name, code, address, business_start_time: "09:00", business_end_time: "22:00" });
      setFormKey((k) => k + 1);
      setStatus(`已新增分店：${name}`);
      reloadBranches();
    } catch (e) {
      alertApiError(e);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: BranchDto) {
    setEditing(row);
    setEditForm({ name: row.name, code: row.code, address: row.address });
    setStatus("");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !editForm) return;
    setSaving(true);
    setStatus("");
    try {
      await api.updateBranch(editing.id, {
        name: editForm.name.trim(),
        code: editForm.code.trim().toUpperCase(),
        address: editForm.address.trim()
      });
      setEditing(null);
      setEditForm(null);
      setStatus("分店資料已更新。");
      reloadBranches();
    } catch (e) {
      alertApiError(e);
    } finally {
      setSaving(false);
    }
  }

  async function removeBranch(row: BranchDto) {
    if (!window.confirm(`確定刪除分店「${row.name}」？`)) return;
    setStatus("");
    try {
      await api.deleteBranch(row.id, false);
      setStatus(`已刪除分店 ${row.name}。`);
      if (editing?.id === row.id) {
        setEditing(null);
        setEditForm(null);
      }
      reloadBranches();
    } catch (e) {
      alertApiError(e);
    }
  }

  async function toggleCategoryActive(row: CourseCategoryDto, nextActive: boolean) {
    setStatus("");
    try {
      await api.patchCourseCategory(row.id, { is_active: nextActive });
      await reloadCategories();
      setStatus("已更新課程種類狀態。");
    } catch (e) {
      alertApiError(e);
    }
  }

  async function onCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      setStatus("請輸入 Course 種類名稱。");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      await api.createCourseCategory({ name });
      event.currentTarget.reset();
      setStatus(`已新增：${name}`);
      reloadCategories();
    } catch (e) {
      alertApiError(e);
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategoryHidden(row: CourseCategoryDto) {
    setStatus("");
    try {
      if (row.is_deleted) {
        await api.showCourseCategory(row.id);
        setStatus(`已恢復：${row.name}`);
      } else {
        await api.hideCourseCategory(row.id);
        setStatus(`已隱藏：${row.name}`);
      }
      reloadCategories();
    } catch (e) {
      alertApiError(e);
    }
  }

  const visibleCategories = categories.filter((row) => !row.is_deleted);

  if (!isAdmin) {
    return (
      <BackendShell title="分店/課堂類別管理">
        <p className="text-sm text-ink/60">僅 ADMIN 可管理分店。</p>
      </BackendShell>
    );
  }

  return (
    <BackendShell title="分店/課堂類別管理">
      <div className="mx-auto max-w-5xl space-y-10">
        <div>
          <h2 className="text-2xl font-semibold text-ink">分店/課堂類別管理</h2>
          <p className="mt-1 text-sm text-ink/65">
            顯示名稱 · 代碼 · 地址（預設：尖沙咀 <code className="text-xs">TST</code>、上環{" "}
            <code className="text-xs">SW</code>）。教練報 Course 時須揀分店。
          </p>
        </div>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-ink">新增分店</h3>
          <form
            key={formKey}
            onSubmit={(e) => void onCreateBranch(e)}
            className="grid gap-3 rounded-xl border border-ink/10 bg-surface p-5 shadow-sm md:grid-cols-3"
          >
            <input
              name="name"
              required
              placeholder="顯示名稱（例：尖沙咀分店）"
              className="rounded-lg border border-ink/10 px-3 py-2 text-sm"
            />
            <input
              name="code"
              required
              placeholder="代碼（例：TST）"
              className="rounded-lg border border-ink/10 px-3 py-2 text-sm uppercase"
            />
            <input
              name="address"
              required
              placeholder="地址"
              className="rounded-lg border border-ink/10 px-3 py-2 text-sm md:col-span-3"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50 md:col-span-3 md:justify-self-start"
            >
              {saving ? "新增中…" : "新增分店"}
            </button>
          </form>

          {editing && editForm ? (
            <form
              onSubmit={(e) => void saveEdit(e)}
              className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-5 md:grid-cols-3"
            >
              <h4 className="text-base font-semibold text-ink md:col-span-3">編輯 · {editing.name}</h4>
              <input
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="顯示名稱"
                className="rounded-lg border border-ink/10 px-3 py-2 text-sm"
              />
              <input
                required
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                placeholder="代碼"
                className="rounded-lg border border-ink/10 px-3 py-2 text-sm uppercase"
              />
              <input
                required
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="地址"
                className="rounded-lg border border-ink/10 px-3 py-2 text-sm md:col-span-3"
              />
              <div className="flex gap-2 md:col-span-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink"
                >
                  儲存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setEditForm(null);
                  }}
                  className="rounded-lg border border-ink/15 bg-canvas px-4 py-2 text-sm"
                >
                  取消
                </button>
              </div>
            </form>
          ) : null}

          {status ? <p className="text-sm text-emerald-800">{status}</p> : null}

          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="border-b border-ink/10 bg-canvas/50 text-ink/65">
                <tr>
                  <th className="px-4 py-3 font-medium">顯示名稱</th>
                  <th className="px-4 py-3 font-medium">代碼</th>
                  <th className="px-4 py-3 font-medium">地址</th>
                  <th className="px-4 py-3 font-medium">狀態</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id} className="border-b border-ink/[0.06] text-ink/85">
                    <td className="px-4 py-3 font-medium text-ink">{b.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{b.code}</td>
                    <td className="max-w-md px-4 py-3 text-xs">{b.address}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {b.active !== false ? (
                        <span className="inline-flex whitespace-nowrap rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium leading-none text-emerald-800">
                          啟用
                        </span>
                      ) : (
                        <span className="inline-flex whitespace-nowrap rounded-full bg-ink/10 px-2.5 py-1 text-xs leading-none text-ink/55">
                          停用
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(b)}
                          className="rounded-md border border-ink/15 bg-canvas px-3 py-1 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeBranch(b)}
                          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-800"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3 border-t border-ink/10 pt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-ink">課堂種類（新增／修改）</h3>
              <p className="mt-1 text-xs text-ink/55">編輯「啟用」會影響試堂下拉與報 Course 的課程名稱選項。</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  try {
                    await downloadCsv("/api/admin/course-categories/export.csv", "course-categories.csv");
                    setStatus("已匯出課堂種類 CSV（僅名稱）。");
                  } catch (e) {
                    alertApiError(e);
                  }
                })();
              }}
              className="shrink-0 rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm font-medium text-ink hover:border-primary/40"
            >
              匯出 CSV（名稱）
            </button>
          </div>

          <form
            onSubmit={(event) => void onCreateCategory(event)}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm"
          >
            <label className="min-w-[16rem] flex-1 text-sm font-medium text-ink">
              新增 Course 種類
              <input
                name="name"
                placeholder="例如：Boxing 拳擊"
                className="mt-2 w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm text-ink"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {saving ? "新增中…" : "新增種類"}
            </button>
          </form>

          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="border-b border-ink/10 bg-canvas/50 text-ink/65">
                <tr>
                  <th className="px-4 py-2 font-medium">課程名稱</th>
                  <th className="px-4 py-2 font-medium">狀態</th>
                  <th className="px-4 py-2 font-medium">啟用</th>
                  <th className="px-4 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((row) => (
                  <tr key={row.id} className="border-b border-ink/[0.06] text-ink/85">
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3">
                      {row.is_deleted ? (
                        <span className="rounded-full bg-ink/10 px-2 py-1 text-xs text-ink/55">隱藏</span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-800">顯示</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={Boolean(row.is_deleted)}
                        onClick={() => void toggleCategoryActive(row, !row.is_active)}
                        className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                          row.is_active ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-900" : "border-ink/15 bg-canvas text-ink/55"
                        } disabled:opacity-40`}
                      >
                        {row.is_active ? "Y" : "N"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void toggleCategoryHidden(row)}
                        className="rounded-lg border border-ink/15 bg-canvas px-3 py-1.5 text-xs font-semibold"
                      >
                        {row.is_deleted ? "恢復" : "隱藏"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink/50">啟用中種類：{visibleCategories.filter((row) => row.is_active).length}</p>
        </section>
      </div>
    </BackendShell>
  );
}
