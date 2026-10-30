"use client";

/**
 * [F004][S005]
 * Feature: Admin Reports & Financials
 * Step: Coach Attendance Income Export UI
 * Logic: Date range + coach filter; clickable student names open session detail modal.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, X } from "lucide-react";
import { alertApiError, api } from "../lib/api";
import {
  type CoachAttendanceIncomeRow,
  type CoachAttendanceIncomeStudentRow,
  type StudentAttendanceDetail,
  defaultCoachIncomeDateRange,
  downloadCoachAttendanceIncomeCsv,
  downloadCoachAttendanceIncomeExcel,
  fetchCoachAttendanceIncomeRows,
  flattenCoachAttendanceIncomeStudentRows,
  formatStudentLessonLabel,
  formatStudentSessionDateTime,
  isNextUpcomingLesson,
  studentSessionStatusLabel
} from "../lib/coach-attendance-income-export";

type CourseCategoryOption = { id: number; name: string };
type CoachOption = { id: number; full_name: string; active?: boolean };

type StudentDetailModalState = {
  coachName: string;
  courseName: string;
  detail: StudentAttendanceDetail;
};

type SortKey = "coachName" | "courseName" | "branchName" | "students" | "attendanceDates";
type SortDir = "asc" | "desc";

function groupLabel(name: string): string {
  if (name.includes("泰拳") || name.toLowerCase().includes("boxing")) return "泰拳";
  if (name.includes("一對二") || name.includes("1-2") || name.includes("1:2")) return "1-2";
  if (name.includes("一對一") || name.includes("1-1") || name.includes("1:1")) return "1-1";
  return "其他";
}

function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === column;
  return (
    <th className="px-3 py-2.5 font-semibold">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left hover:text-ink"
        onClick={() => onSort(column)}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />
        )}
      </button>
    </th>
  );
}

export default function CoachAttendanceIncomeExport() {
  const defaults = useMemo(() => defaultCoachIncomeDateRange(), []);
  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [coachId, setCoachId] = useState<number | "">("");
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [categories, setCategories] = useState<CourseCategoryOption[]>([]);
  const [rows, setRows] = useState<CoachAttendanceIncomeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [status, setStatus] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [studentModal, setStudentModal] = useState<StudentDetailModalState | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("coachName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    void api
      .coaches()
      .then((list) => setCoaches(list as CoachOption[]))
      .catch(() => setCoaches([]));
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

  const studentRows = useMemo(
    () => flattenCoachAttendanceIncomeStudentRows(rows, fromDate, toDate),
    [rows, fromDate, toDate]
  );

  const sortedRows = useMemo(() => {
    const mul = sortDir === "asc" ? 1 : -1;
    const value = (r: CoachAttendanceIncomeStudentRow) =>
      sortKey === "coachName"
        ? r.coachName
        : sortKey === "courseName"
          ? r.courseName
          : sortKey === "branchName"
            ? r.branchName
            : sortKey === "students"
              ? r.studentName
              : r.attendanceDates;
    return [...studentRows].sort(
      (a, b) => mul * String(value(a)).localeCompare(String(value(b)), "zh-Hant")
    );
  }, [studentRows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

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
        coachId,
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
  }, [fromDate, toDate, coachId, categoryIds]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  function toggleCategory(id: number) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function openStudentModal(row: CoachAttendanceIncomeStudentRow) {
    setStudentModal({
      coachName: row.coachName,
      courseName: row.courseName,
      detail: row.detail
    });
  }

  async function handleExport(format: "csv" | "xlsx") {
    if (fromDate > toDate) {
      setRangeError("開始日期不可晚於結束日期。");
      return;
    }
    if (studentRows.length === 0) {
      setStatus("所選日期範圍內沒有符合條件的出勤紀錄，未匯出檔案。");
      return;
    }
    setExporting(format);
    setStatus("");
    try {
      const coachName =
        coachId !== "" ? coaches.find((c) => c.id === coachId)?.full_name : undefined;
      if (format === "csv") {
        downloadCoachAttendanceIncomeCsv(studentRows, fromDate, toDate, coachName);
      } else {
        await downloadCoachAttendanceIncomeExcel(studentRows, fromDate, toDate, coachName);
      }
      console.log("[F004][S005] Success: Export generated", {
        format,
        fromDate,
        toDate,
        rows: studentRows.length
      });
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
      console.error("[F004][S005] Error: Export failed.", { format });
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-ink sm:text-xl">教練出勤收入匯出</h1>
          <p className="mt-1 text-sm text-ink/55">
            Coach Attendance Income Export — 依教練、課程與學員匯出出勤與學員名單，供 Excel 手動計算佣金。
            點擊學員姓名可查看 package 堂數與上堂時間。CSV／Excel 每學員一行，「學員」欄只列一位學員；「總堂數」為該學員在所選期間的已簽到堂數，「金額 (HKD)」欄位留空。
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => void handleExport("csv")}
            disabled={exporting !== null || loading || studentRows.length === 0 || Boolean(rangeError)}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40 sm:w-auto"
          >
            {exporting === "csv" ? "匯出中…" : "匯出 CSV"}
          </button>
          <button
            type="button"
            onClick={() => void handleExport("xlsx")}
            disabled={exporting !== null || loading || studentRows.length === 0 || Boolean(rangeError)}
            className="w-full rounded-lg border border-primary bg-primary/10 px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40 sm:w-auto"
          >
            {exporting === "xlsx" ? "匯出中…" : "匯出 Excel"}
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
          <label className="block w-full text-sm text-ink sm:min-w-[12rem] sm:w-auto">
            教練
            <select
              value={coachId}
              onChange={(e) =>
                setCoachId(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-2 py-2 text-ink"
            >
              <option value="">全部教練</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                  {c.active === false ? "（已停用）" : ""}
                </option>
              ))}
            </select>
          </label>
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
        ) : studentRows.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-ink/50">
            {rangeError
              ? "請修正日期範圍。"
              : coachId !== ""
                ? "所選教練在此日期範圍內沒有符合條件的已完成出勤紀錄（已簽到）。"
                : "所選日期範圍內沒有符合條件的已完成出勤紀錄（已簽到）。"}
          </p>
        ) : (
          <>
            <p className="border-b border-ink/10 px-4 py-2.5 text-xs text-ink/55">
              預覽 {studentRows.length} 列（每列 = 一位教練 × 一種課程 × 一位學員）。點學員姓名查看堂數與上堂時間。匯出
              CSV／Excel 每學員一行；「學員」欄只列一位學員，「總堂數」為該學員已簽到堂數，空白「金額 (HKD)」欄。
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-ink/10 bg-canvas/80 text-xs text-ink/55">
                  <tr>
                    <SortHeader
                      label="教練"
                      column="coachName"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      label="課程"
                      column="courseName"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      label="分店"
                      column="branchName"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      label="學員"
                      column="students"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      label="出勤記錄"
                      column="attendanceDates"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r) => (
                    <tr
                      key={`${r.coachName}-${r.courseName}-${r.studentName}`}
                      className="border-t border-ink/[0.06] align-top"
                    >
                      <td className="px-3 py-2.5 font-medium text-ink">{r.coachName}</td>
                      <td className="px-3 py-2.5 text-ink/85">{r.courseName}</td>
                      <td className="px-3 py-2.5 text-ink/85">{r.branchName || "—"}</td>
                      <td className="px-3 py-2.5 text-ink/85">
                        <button
                          type="button"
                          className="font-medium text-primary underline-offset-2 hover:underline"
                          onClick={() => openStudentModal(r)}
                        >
                          {r.studentName}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-ink/85">{r.attendanceDates || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {portalReady && studentModal
        ? createPortal(
            <div
              className="fixed inset-0 z-[20000] flex items-center justify-center bg-ink/50 p-4"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setStudentModal(null);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="student-attendance-detail-title"
                className="w-[min(92vw,28rem)] max-h-[85vh] overflow-y-auto rounded-xl border border-ink/15 bg-surface p-5 text-left text-sm text-ink shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 id="student-attendance-detail-title" className="text-base font-semibold text-ink">
                      {studentModal.detail.studentName}
                    </h3>
                    <p className="mt-1 text-xs text-ink/55">
                      教練：{studentModal.coachName} · 課程：{studentModal.courseName}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="關閉"
                    className="rounded-md p-1 text-ink/50 hover:bg-canvas hover:text-ink"
                    onClick={() => setStudentModal(null)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {studentModal.detail.sessions.length === 0 ? (
                  <p className="mt-6 text-sm text-ink/50">找不到此學員的 package 預約表。</p>
                ) : (
                  <>
                    <p className="mt-3 text-xs text-ink/50">
                      完整 package 預約表（含已上堂同未來堂數）
                    </p>
                    <table className="mt-3 w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-ink/10 text-ink/55">
                          <th className="py-2 pr-2 font-semibold">Package 堂數</th>
                          <th className="py-2 pr-2 font-semibold">上堂時間</th>
                          <th className="py-2 pr-2 font-semibold">分店</th>
                          <th className="py-2 font-semibold">狀態</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentModal.detail.sessions.map((session) => {
                          const status = studentSessionStatusLabel(session);
                          const isNext = isNextUpcomingLesson(
                            session,
                            studentModal.detail.sessions
                          );
                          return (
                            <tr
                              key={`${session.sessionDate}-${session.startTime}-${session.lessonNo}`}
                              className={`border-b border-ink/[0.06] align-top ${
                                isNext ? "bg-primary/10" : ""
                              }`}
                            >
                              <td className="py-2 pr-2 text-ink/85">
                                {formatStudentLessonLabel(session)}
                                {isNext ? (
                                  <span className="ml-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                                    下一堂
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-2 pr-2 text-ink/85">
                                {formatStudentSessionDateTime(session)}
                              </td>
                              <td className="py-2 pr-2 text-ink/85">{session.branchName || "—"}</td>
                              <td className="py-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                    status === "已簽到"
                                      ? "bg-emerald-500/15 text-emerald-800"
                                      : status === "待上堂"
                                        ? "bg-primary/15 text-black"
                                        : "bg-ink/5 text-ink/55"
                                  }`}
                                >
                                  {status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}

                <div className="mt-5 flex justify-end border-t border-ink/[0.06] pt-4">
                  <button
                    type="button"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black"
                    onClick={() => setStudentModal(null)}
                  >
                    關閉
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
