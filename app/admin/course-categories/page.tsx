"use client";

/**
 * [F002][S001]
 * Feature: Course Entry & Automation
 * Step: Admin course category maintenance
 * Logic: Add / hide / restore custom categories used by student category enrollment and Course Set labels.
 */

import { FormEvent, useCallback, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { alertApiError, api } from "../../../lib/api";
import type { CourseCategoryDto } from "../../../types/api";

export default function AdminCourseCategoriesPage() {
  const [rows, setRows] = useState<CourseCategoryDto[]>([]);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  /**
   * [F002][S001]
   * Feature: Course Entry & Automation
   * Step: Course category list sync
   * Logic: Load active and hidden categories so Admin can restore soft-hidden options.
   */
  const reload = useCallback(() => {
    api
      .courseCategories(true)
      .then((data) => setRows(Array.isArray(data) ? (data as CourseCategoryDto[]) : []))
      .catch(alertApiError);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  /**
   * [F002][S001]
   * Feature: Course Entry & Automation
   * Step: Admin-created course category
   * Logic: Create a custom course label; backend prevents duplicate active names.
   */
  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      setStatus("請輸入 Course Category 名稱。");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      await api.createCourseCategory({ name });
      event.currentTarget.reset();
      setStatus(`已新增：${name}`);
      reload();
    } catch (e) {
      alertApiError(e);
    } finally {
      setSaving(false);
    }
  }

  /**
   * [F002][S001]
   * Feature: Course Entry & Automation
   * Step: Soft-hide / restore course category
   * Logic: Hidden rows disappear from normal course selection but keep historical records intact.
   */
  async function toggle(row: CourseCategoryDto) {
    setStatus("");
    try {
      if (row.is_deleted) {
        await api.showCourseCategory(row.id);
        setStatus(`已恢復：${row.name}`);
      } else {
        await api.hideCourseCategory(row.id);
        setStatus(`已隱藏：${row.name}`);
      }
      reload();
    } catch (e) {
      alertApiError(e);
    }
  }

  const activeCount = rows.filter((row) => !row.is_deleted).length;

  return (
    <BackendShell title="Course Categories">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Course Categories / 課程分類</h2>
          <p className="mt-1 text-sm text-ink/65">
            Admin 可自行新增或隱藏課程分類。預設包括 Yoga 瑜珈、Stretching 拉伸、Pilates 普拉提；隱藏不會刪除舊紀錄。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <form onSubmit={(event) => void onCreate(event)} className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
            <label className="block text-sm font-medium text-ink">
              新增 Course Category
              <input
                name="name"
                placeholder="例如：Boxing 拳擊"
                className="mt-2 w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="mt-3 rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-primary disabled:opacity-50"
            >
              {saving ? "新增中…" : "新增分類"}
            </button>
          </form>

          <div className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
            <p className="text-xs text-ink/55">啟用中分類</p>
            <p className="mt-2 text-3xl font-semibold text-primary">{activeCount}</p>
            <p className="mt-1 text-xs text-ink/50">隱藏分類仍保留歷史資料。</p>
          </div>
        </div>

        {status ? <p className="rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink/80">{status}</p> : null}

        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="border-b border-ink/10 bg-canvas/50 text-ink/65">
              <tr>
                <th className="px-4 py-2 font-medium">名稱</th>
                <th className="px-4 py-2 font-medium">狀態</th>
                <th className="px-4 py-2 font-medium">建立來源</th>
                <th className="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-ink/[0.06] text-ink/85">
                  <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                  <td className="px-4 py-3">
                    {row.is_deleted ? (
                      <span className="rounded-full bg-ink/10 px-2 py-1 text-xs text-ink/55">隱藏</span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-800">啟用</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink/55">{row.created_by_role ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void toggle(row)}
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
      </div>
    </BackendShell>
  );
}
