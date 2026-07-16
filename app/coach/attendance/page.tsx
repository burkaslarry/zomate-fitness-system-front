"use client";

/**
 * [F008][S004]
 * Feature: Coach Session Management
 * Step: Staff 教練出勤 — monthly Course Type | Students | 上堂日期
 * Logic: Month dropdown (yyyy-MM, default current); dashboard + Excel under 教練上堂.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import CoachCategoryFilter from "../../../components/coach-category-filter";
import { alertApiError, api } from "../../../lib/api";
import { getAuthSession } from "../../../lib/auth";
import { exportRowsToExcelSheet } from "../../../lib/excel-export";

type CoachOpt = { id: number; full_name: string };
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

export default function CoachAttendanceReportPage() {
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [coaches, setCoaches] = useState<CoachOpt[]>([]);
  const [coachId, setCoachId] = useState<number | "">("");
  const [month, setMonth] = useState(currentMonthValue);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [rangeLabel, setRangeLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const s = getAuthSession();
    if (!s) return;
    if (s.role === "COACH") {
      window.location.replace("/coach-portal/report");
      return;
    }
    if (s.role !== "ADMIN" && s.role !== "CLERK") {
      setDenied(true);
      setReady(true);
      return;
    }
    setReady(true);
    void api
      .coaches()
      .then((list) => {
        const arr = list as CoachOpt[];
        setCoaches(arr);
        if (arr.length) setCoachId(arr[0].id);
      })
      .catch((e) => setStatus(String(e)));
  }, []);

  const loadReport = useCallback(async () => {
    if (coachId === "") {
      setRows([]);
      setRangeLabel("");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const data = (await api.coachAttendanceReport(Number(coachId), {
        month,
        categoryIds: categoryIds.length ? categoryIds : undefined
      })) as ReportPayload;
      setRows(data.rows ?? []);
      setRangeLabel(`${data.from_date} – ${data.to_date}`);
      console.log("[F008][S004] Success: Loaded coach attendance report", {
        month: data.month,
        count: data.rows?.length ?? 0
      });
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
      setRows([]);
      console.error("[F008][S004] Error: Failed to load coach attendance report.");
    } finally {
      setLoading(false);
    }
  }, [coachId, month, categoryIds]);

  useEffect(() => {
    if (!ready || coachId === "") return;
    void loadReport();
  }, [ready, coachId, loadReport]);

  async function exportExcel() {
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
  }

  if (!ready) return null;

  if (denied) {
    return (
      <BackendShell title="教練出勤">
        <p className="text-sm text-ink/70">此頁面僅供職員帳號使用。</p>
      </BackendShell>
    );
  }

  return (
    <BackendShell title="教練出勤">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-ink sm:text-xl">教練出勤</h1>
            <p className="mt-1 text-sm text-ink/55">
              依課程類型列出跟進學員與上堂日期。月份預設本月（yyyy-MM）。
              {rangeLabel ? (
                <span className="mt-0.5 block text-ink/80 sm:ml-1 sm:inline">範圍：{rangeLabel}</span>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-ink/45">
              <Link href="/coach" className="font-medium text-primary underline-offset-2 hover:underline">
                ← 教練上堂
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={rows.length === 0 || loading}
            className="w-full shrink-0 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 sm:w-auto"
          >
            匯出 Excel
          </button>
        </div>

        <section className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
            <label className="block w-full text-sm text-ink sm:min-w-[12rem] sm:w-auto">
              教練
              <select
                value={coachId}
                onChange={(e) => setCoachId(e.target.value ? Number(e.target.value) : "")}
                className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-2 py-2 text-ink"
              >
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block w-full text-sm text-ink sm:w-auto">
              月份（yyyy-MM）
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value || currentMonthValue())}
                className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-2 py-2 text-ink"
              />
            </label>
          </div>
          <CoachCategoryFilter
            className="mt-4"
            coachId={coachId}
            selectedIds={categoryIds}
            onChange={setCategoryIds}
          />
        </section>

        {status ? <p className="text-sm text-rose-600">{status}</p> : null}

        {/* Mobile: card stack */}
        <section className="space-y-3 md:hidden">
          {rows.length === 0 ? (
            <p className="rounded-xl border border-ink/10 bg-surface px-4 py-8 text-center text-sm text-ink/50">
              {loading ? "載入中…" : "此月份沒有符合條件的上堂紀錄。"}
            </p>
          ) : (
            rows.map((r) => (
              <article
                key={r.course_type}
                className="rounded-xl border border-ink/10 bg-surface p-3.5 shadow-sm"
              >
                <h3 className="text-sm font-semibold text-ink">{r.course_type}</h3>
                <dl className="mt-2.5 space-y-2 text-xs">
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
        </section>

        {/* Desktop: table */}
        <section className="hidden overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink/10 bg-canvas/80 text-xs text-ink/55">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Course Type</th>
                <th className="px-3 py-2.5 font-semibold">Students</th>
                <th className="px-3 py-2.5 font-semibold">上堂日期</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-ink/50">
                    {loading ? "載入中…" : "此月份沒有符合條件的上堂紀錄。"}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.course_type} className="border-t border-ink/[0.06] align-top">
                    <td className="px-3 py-2.5 font-medium text-ink">{r.course_type}</td>
                    <td className="px-3 py-2.5 text-ink/85">{r.students}</td>
                    <td className="px-3 py-2.5 text-ink/85">{r.session_dates}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </BackendShell>
  );
}
