"use client";

/**
 * [F008][S004]
 * Feature: Coach Session Management
 * Step: Coach portal 教練出勤 — month (yyyy-MM) + Course Type | Students | 上堂日期
 * Logic: COACH-only; default current month; Excel matches dashboard table.
 */

import { useCallback, useEffect, useState } from "react";
import { alertApiError, api } from "../../../lib/api";
import { getAuthSession } from "../../../lib/auth";
import CoachCategoryFilter from "../../../components/coach-category-filter";
import { exportRowsToExcelSheet } from "../../../lib/excel-export";

type CoachMe = { id: number; full_name: string };
type ReportRow = {
  course_type: string;
  students: string;
  session_dates: string;
};
type ReportPayload = {
  month: string;
  from_date: string;
  to_date: string;
  rows: ReportRow[];
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export default function CoachPortalReportPage() {
  const [coach, setCoach] = useState<CoachMe | null>(null);
  const [month, setMonth] = useState(currentMonthValue);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [rangeLabel, setRangeLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const s = getAuthSession();
    if (s?.role !== "COACH") return;
    void api
      .coachMe()
      .then((me) => setCoach(me as CoachMe))
      .catch(() => setCoach(null));
  }, []);

  const load = useCallback(async () => {
    if (!coach) return;
    setLoading(true);
    try {
      const data = (await api.coachAttendanceReport(coach.id, {
        month,
        categoryIds: categoryIds.length ? categoryIds : undefined
      })) as ReportPayload;
      setRows(data.rows ?? []);
      setRangeLabel(`${data.from_date} – ${data.to_date}`);
      console.log("[F008][S004] Success: Coach portal attendance report", {
        month: data.month,
        count: data.rows?.length ?? 0
      });
    } catch (e) {
      setRows([]);
      setRangeLabel("");
      alertApiError(e);
    } finally {
      setLoading(false);
    }
  }, [coach, month, categoryIds]);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportExcel() {
    if (!coach) return;
    setExporting(true);
    try {
      await exportRowsToExcelSheet({
        filename: `coach-attendance-${month}`,
        sheetName: `出勤 ${month}`,
        columns: [
          { header: "Course Type", key: "course_type" },
          { header: "Students", key: "students" },
          { header: "上堂日期", key: "session_dates" }
        ],
        rows: rows.map((r) => ({
          course_type: r.course_type,
          students: r.students,
          session_dates: r.session_dates
        }))
      });
      console.log("[F008][S004] Success: Excel exported for month " + month);
    } catch (e) {
      alertApiError(e);
    } finally {
      setExporting(false);
    }
  }

  if (!coach) return <p className="text-sm text-ink/50">載入教練資料…</p>;

  return (
    <div className="space-y-4 pb-24">
      <section className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">教練出勤 · {coach.full_name}</h2>
        <p className="mt-1 text-xs text-ink/55">
          依課程類型列出跟進學員與上堂日期。預設本月（yyyy-MM）。
          {rangeLabel ? <span className="ml-1">範圍：{rangeLabel}</span> : null}
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="block w-full text-xs text-ink sm:w-auto">
            月份（yyyy-MM）
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value || currentMonthValue())}
              className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-2 py-2 text-sm"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={exporting || rows.length === 0}
              onClick={() => void exportExcel()}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              {exporting ? "匯出中…" : "匯出 Excel"}
            </button>
          </div>
        </div>
        <CoachCategoryFilter
          className="mt-4"
          coachId={coach.id}
          selectedIds={categoryIds}
          onChange={setCategoryIds}
        />
      </section>

      <section className="overflow-x-auto rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
        <p className="text-xs text-ink/55">{loading ? "載入中…" : `共 ${rows.length} 種課程類型`}</p>

        {/* Mobile: cards */}
        <div className="mt-3 space-y-3 md:hidden">
          {rows.length === 0 && !loading ? (
            <p className="py-6 text-center text-xs text-ink/45">此月份沒有符合條件的上堂紀錄。</p>
          ) : (
            rows.map((r) => (
              <article
                key={r.course_type}
                className="rounded-lg border border-ink/[0.08] bg-canvas/50 p-3"
              >
                <h3 className="text-sm font-semibold text-ink">{r.course_type}</h3>
                <dl className="mt-2 space-y-2 text-xs">
                  <div>
                    <dt className="font-medium text-ink/50">Students</dt>
                    <dd className="mt-0.5 leading-relaxed text-ink/85">{r.students || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink/50">上堂日期</dt>
                    <dd className="mt-0.5 leading-relaxed text-ink/85">{r.session_dates || "—"}</dd>
                  </div>
                </dl>
              </article>
            ))
          )}
        </div>

        {/* Desktop: table */}
        <table className="mt-3 hidden w-full min-w-[28rem] text-left text-xs md:table">
          <thead>
            <tr className="border-b border-ink/10 text-ink/55">
              <th className="py-2 pr-2 font-semibold">Course Type</th>
              <th className="py-2 pr-2 font-semibold">Students</th>
              <th className="py-2 pr-2 font-semibold">上堂日期</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-ink/45">
                  此月份沒有符合條件的上堂紀錄。
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.course_type} className="border-b border-ink/[0.05] align-top">
                  <td className="py-2 pr-2 font-medium text-ink">{r.course_type}</td>
                  <td className="py-2 pr-2 text-ink/85">{r.students}</td>
                  <td className="py-2 pr-2 text-ink/85">{r.session_dates}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
