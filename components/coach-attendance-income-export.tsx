"use client";

/**
 * [F004][S005]
 * Feature: Admin Reports & Financials
 * Step: Coach Attendance Income Export UI
 * Logic: Date range + optional course-type filter; preview table (no HKD column); UTF-8 CSV export.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { alertApiError, api } from "../lib/api";
import {
  type CoachAttendanceIncomeRow,
  defaultCoachIncomeDateRange,
  downloadCoachAttendanceIncomeCsv,
  fetchCoachAttendanceIncomeRows
} from "../lib/coach-attendance-income-export";

type CourseCategoryOption = { id: number; name: string };

function groupLabel(name: string): string {
  if (name.includes("泰拳")) return "泰拳";
  if (name.includes("一對二") || name.includes("1-2") || name.includes("1:2")) return "1-2";
  if (name.includes("一對一") || name.includes("1-1") || name.includes("1:1")) return "1-1";
  return "其他";
}

export default function CoachAttendanceIncomeExport() {
  const defaults = useMemo(() => defaultCoachIncomeDateRange(), []);
  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [categories, setCategories] = useState<CourseCategoryOption[]>([]);
  const [rows, setRows] = useState<CoachAttendanceIncomeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");
  const [rangeError, setRangeError] = useState("");

  useEffect(() => {
    void api
      .courseCategories()
      .then((list) => {
        const arr = (list as { id: number; name: string; is_active?: boolean }[])
          .filter((c) => c.is_active !== false)
          .map((c) => ({ id: c.id, name: c.name }));
        setCategories(arr);
      })
      .catch(() => setCategories([]));
  }, []);

  const groupedCategories = useMemo(() => {
    const m = new Map<string, CourseCategoryOption[]>();
    for (const c of categories) {
      const g = groupLabel(c.name);
      const list = m.get(g) ?? [];
      list.push(c);
      m.set(g, list);
    }
    return m;
  }, [categories]);

  const loadPreview = useCallback(async () => {
    if (fromDate > toDate) {
      setRangeError("開始日期不可晚於結束日期。");
      setRows([]);
      return;
    }
    setRangeError("");
    setLoading(true);
    setStatus("");
    try {
      const data = await fetchCoachAttendanceIncomeRows({
        fromDate,
        toDate,
        categoryIds: categoryIds.length ? categoryIds : undefined
      });
      setRows(data);
      console.log("[F004][S005] Success: Loaded coach attendance income preview", {
        fromDate,
        toDate,
        count: data.length
      });
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
      setRows([]);
      console.error("[F004][S005] Error: Failed to load coach attendance income preview.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, categoryIds]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  function toggleCategory(id: number) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleExport() {
    if (fromDate > toDate) {
      setRangeError("開始日期不可晚於結束日期。");
      return;
    }
    if (rows.length === 0) {
      setStatus("所選日期範圍內沒有符合條件的出勤紀錄，未匯出檔案。");
      return;
    }
    setExporting(true);
    setStatus("");
    try {
      downloadCoachAttendanceIncomeCsv(rows, fromDate, toDate);
      console.log("[F004][S005] Success: CSV exported", { fromDate, toDate, rows: rows.length });
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
      console.error("[F004][S005] Error: CSV export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-ink sm:text-xl">教練出勤收入匯出</h1>
          <p className="mt-1 text-sm text-ink/55">
            Coach Attendance Income Export — 依教練與課程匯出出勤與學員名單，供 Excel 手動計算佣金。
            「金額 (HKD)」欄位留空，由管理員自行填寫。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || loading || rows.length === 0 || Boolean(rangeError)}
          className="w-full shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40 sm:w-auto"
        >
          {exporting ? "匯出中…" : "匯出 CSV"}
        </button>
      </div>

      <section className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
          <label className="block w-full text-sm text-ink sm:w-auto">
            開始日期
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-2 py-2 text-ink"
            />
          </label>
          <label className="block w-full text-sm text-ink sm:w-auto">
            結束日期
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-2 py-2 text-ink"
            />
          </label>
        </div>

        {categories.length > 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">課程類型（可選）</p>
            {[...groupedCategories.entries()].map(([group, items]) => (
              <div key={group}>
                <p className="text-[11px] font-medium text-ink/50">{group}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {items.map((c) => {
                    const active = categoryIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCategory(c.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition ${
                          active
                            ? "border-primary bg-primary/15 font-medium text-black"
                            : "border-ink/15 bg-canvas text-ink/70 hover:border-primary/30"
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {rangeError ? <p className="text-sm text-rose-600">{rangeError}</p> : null}
      {status ? <p className="text-sm text-amber-800">{status}</p> : null}

      <section className="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink/50">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            載入出勤資料…
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-ink/50">
            {rangeError
              ? "請修正日期範圍。"
              : "所選日期範圍內沒有符合條件的已完成出勤紀錄（已簽到）。"}
          </p>
        ) : (
          <>
            <p className="border-b border-ink/10 px-4 py-2.5 text-xs text-ink/55">
              預覽 {rows.length} 列（每列 = 一位教練 × 一種課程）。匯出 CSV 會額外包含空白「金額 (HKD)」欄。
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-ink/10 bg-canvas/80 text-xs text-ink/55">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">教練</th>
                    <th className="px-3 py-2.5 font-semibold">課程</th>
                    <th className="px-3 py-2.5 font-semibold">學員</th>
                    <th className="px-3 py-2.5 font-semibold">出勤時間</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={`${r.coachName}-${r.courseName}`}
                      className="border-t border-ink/[0.06] align-top"
                    >
                      <td className="px-3 py-2.5 font-medium text-ink">{r.coachName}</td>
                      <td className="px-3 py-2.5 text-ink/85">{r.courseName}</td>
                      <td className="px-3 py-2.5 text-ink/85">{r.students || "—"}</td>
                      <td className="px-3 py-2.5 text-ink/85">{r.attendanceDates || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
