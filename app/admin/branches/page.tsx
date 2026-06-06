"use client";

/**
 * [F002][S001]
 * Feature: Course Entry & Automation
 * Step: Branches and course category maintenance
 * Logic: 課堂和分店管理 — branches list + zomate_fs_course_categories (試堂／開課共用).
 */

import { FormEvent, useCallback, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { alertApiError, api } from "../../../lib/api";
import type { BranchDto, CourseCategoryDto } from "../../../types/api";

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [categories, setCategories] = useState<CourseCategoryDto[]>([]);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

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
    reloadBranches();
    reloadCategories();
  }, [reloadBranches, reloadCategories]);

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

  return (
    <BackendShell title="課堂和分店管理">
      <div className="mx-auto max-w-5xl space-y-10">
        <div>
          <h2 className="text-2xl font-semibold text-ink">課堂和分店管理</h2>
          <p className="mt-1 text-sm text-ink/65">
            分店資料與 Course 種類（試堂／開課共用）— 資料來源 <code className="text-xs">zomate_fs_course_categories</code>。
          </p>
        </div>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-ink">分店列表</h3>
          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="border-b border-ink/10 bg-canvas/50 text-ink/65">
                <tr>
                  <th className="px-4 py-2 font-medium">名稱</th>
                  <th className="px-4 py-2 font-medium">代碼</th>
                  <th className="px-4 py-2 font-medium">地址</th>
                  <th className="px-4 py-2 font-medium">營業時間</th>
                  <th className="px-4 py-2 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id} className="border-b border-ink/[0.06] text-ink/85">
                    <td className="px-4 py-3 font-medium text-ink">{b.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{b.code}</td>
                    <td className="max-w-xs px-4 py-3 text-xs">{b.address}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {b.business_start_time && b.business_end_time
                        ? `${b.business_start_time}–${b.business_end_time}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {b.active !== false ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-800">啟用</span>
                      ) : (
                        <span className="rounded-full bg-ink/10 px-2 py-1 text-xs text-ink/55">停用</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-ink">Course 種類（試堂／開課共用）</h3>
              <p className="mt-1 text-xs text-ink/55">編輯「啟用」會影響試堂下拉與報 Course 的課程名稱選項。</p>
            </div>
          </div>

          <form
            onSubmit={(event) => void onCreateCategory(event)}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]"
          >
            <label className="min-w-[16rem] flex-1 text-sm font-medium text-ink">
              新增 Course 種類
              <input
                name="name"
                placeholder="例如：Boxing 拳擊"
                className="mt-2 w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-primary disabled:opacity-50"
            >
              {saving ? "新增中…" : "新增種類"}
            </button>
          </form>

          {status ? <p className="text-sm text-emerald-800">{status}</p> : null}
          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
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
                        className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                          row.is_active
                            ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-900"
                            : "border-ink/15 bg-canvas text-ink/55"
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {row.is_active ? "Y" : "N"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void toggleCategoryHidden(row)}
                        className="rounded-lg border border-ink/15 bg-canvas px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface"
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
