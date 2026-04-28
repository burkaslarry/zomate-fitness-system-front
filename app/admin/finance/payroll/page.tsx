"use client";

/** @feature [F04.3][F04.5] monthly coach attendance from student lesson rows */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Table
} from "@tanstack/react-table";
import BackendShell from "../../../../components/backend-shell";
import { api } from "../../../../lib/api";
import { exportRowsToExcelSheet } from "../../../../lib/excel-export";
import { csvRow } from "../../../../lib/csv-rfc4180";

type LessonRow = {
  studentName: string;
  courseName: string;
  sessionTimeIso: string;
  coachName: string;
  courseStartDate: string;
  courseEndDate: string;
};

type SummaryRow = {
  coachName: string;
  month: string;
  classesTaught: number;
  hoursOnFloor: number;
  grossPayHkd: number;
};

function ymNow(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatSessionTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function AdminFinancePayrollPage() {
  const [month, setMonth] = useState(ymNow());
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id: "studentName", desc: false }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = (await api.reportsCoachAttendance({ month })) as {
        rows?: LessonRow[];
        summary?: SummaryRow[];
      };
      setLessons(Array.isArray(json.rows) ? json.rows : []);
      setSummary(Array.isArray(json.summary) ? json.summary : []);
    } catch {
      setLessons([]);
      setSummary([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const lessonColumns = useMemo<ColumnDef<LessonRow>[]>(
    () => [
      { accessorKey: "studentName", id: "studentName", header: "學員" },
      { accessorKey: "courseName", id: "courseName", header: "課程" },
      {
        accessorKey: "sessionTimeIso",
        id: "sessionTimeIso",
        header: "上堂時間",
        cell: (c) => formatSessionTime(String(c.getValue())),
        sortingFn: (ra, rb, id) => {
          const a = new Date(String(ra.getValue(id))).getTime();
          const b = new Date(String(rb.getValue(id))).getTime();
          return (Number.isNaN(a) ? 0 : a) - (Number.isNaN(b) ? 0 : b);
        }
      },
      { accessorKey: "coachName", id: "coachName", header: "教練" },
      {
        accessorKey: "courseStartDate",
        id: "courseStartDate",
        header: "課程開始日"
      },
      {
        accessorKey: "courseEndDate",
        id: "courseEndDate",
        header: "課程結束日"
      }
    ],
    []
  );

  const lessonTable = useReactTable({
    data: lessons,
    columns: lessonColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel()
  });

  const summaryColumns = useMemo<ColumnDef<SummaryRow>[]>(
    () => [
      { accessorKey: "month", header: "月份" },
      { accessorKey: "coachName", header: "教練" },
      { accessorKey: "classesTaught", header: "堂數" },
      { accessorKey: "hoursOnFloor", header: "Floor 時數" },
      {
        accessorKey: "grossPayHkd",
        header: "薪酬 (HKD)",
        cell: (c) => Number(c.getValue()).toLocaleString()
      }
    ],
    []
  );

  const summaryTable = useReactTable({
    data: summary,
    columns: summaryColumns,
    getCoreRowModel: getCoreRowModel()
  });

  function buildLessonCsvRows(tbl: Table<LessonRow>): { headers: string[]; lines: string[][] } {
    const headers = ["學員", "課程", "上堂時間", "教練", "課程開始日", "課程結束日"];
    const lines = tbl.getRowModel().rows.map((row) => {
      const o = row.original;
      return [
        o.studentName,
        o.courseName,
        formatSessionTime(o.sessionTimeIso),
        o.coachName,
        o.courseStartDate,
        o.courseEndDate
      ];
    });
    return { headers, lines };
  }

  async function exportLessonsExcel() {
    const cols = [
      { header: "學員", key: "studentName" },
      { header: "課程", key: "courseName" },
      { header: "上堂時間", key: "sessionTimeIso" },
      { header: "教練", key: "coachName" },
      { header: "課程開始日", key: "courseStartDate" },
      { header: "課程結束日", key: "courseEndDate" }
    ];
    await exportRowsToExcelSheet({
      filename: `coach-lessons-${month}`,
      sheetName: "Lessons",
      columns: cols,
      rows: lessons.map((o) => ({
        ...o,
        sessionTimeIso: formatSessionTime(o.sessionTimeIso)
      })) as Record<string, unknown>[]
    });
  }

  function exportLessonsCsv() {
    const { headers, lines } = buildLessonCsvRows(lessonTable);
    const csvLines = [csvRow(headers), ...lines.map(csvRow)];
    const blob = new Blob([`\uFEFF${csvLines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = `coach-lessons-${month}.csv`;
      a.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <BackendShell title="薪酬 / 出勤報表">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">教練出勤（學員上堂 = 出勤記錄）</h2>
            <p className="mt-1 text-sm text-zinc-500">
              <code className="rounded bg-[#262626] px-1 py-0.5 text-xs">GET /api/v1/reports/coach-attendance?month=YYYY-MM</code>
              · PostgreSQL：<code className="text-xs">AuditLog.checkin_redeem</code> + 課程日期
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              月份
              <input
                type="month"
                className="rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-2 py-1.5 text-zinc-100"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-sm text-zinc-100 hover:bg-[#262626]"
              onClick={() => void exportLessonsExcel()}
              disabled={lessons.length === 0}
            >
              Export Excel（明細）
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-sm text-zinc-100 hover:bg-[#262626]"
              onClick={() => exportLessonsCsv()}
              disabled={lessons.length === 0}
            >
              Export CSV（明細）
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">載入中…</p>
        ) : (
          <>
            <div>
              <h3 className="mb-2 text-lg font-medium text-zinc-200">每月上堂明細</h3>
              <p className="mb-3 text-xs text-zinc-500">欄位：學員、課程、時間、教練、課程開始／結束日 · 點欄位標題可排序（預設按學員姓名）。</p>
              <div className="overflow-x-auto rounded-xl border border-white/[0.1] bg-[#141414]">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    {lessonTable.getHeaderGroups().map((hg) => (
                      <tr key={hg.id} className="border-b border-white/[0.08] bg-[#1a1a1a]">
                        {hg.headers.map((h) => (
                          <th
                            key={h.id}
                            className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400"
                            onClick={h.column.getToggleSortingHandler()}
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {h.column.getIsSorted() === "asc" ? " ↑" : h.column.getIsSorted() === "desc" ? " ↓" : ""}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {lessonTable.getRowModel().rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-zinc-500">
                          此月份未有上堂／簽到記錄。
                        </td>
                      </tr>
                    ) : (
                      lessonTable.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="border-b border-[#222] hover:bg-[#1a1a1a]/80">
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-4 py-3 align-middle text-zinc-200">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-medium text-zinc-200">教練彙總（參考）</h3>
              <div className="overflow-x-auto rounded-xl border border-white/[0.1] bg-[#141414]">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    {summaryTable.getHeaderGroups().map((hg) => (
                      <tr key={hg.id} className="border-b border-white/[0.08] bg-[#1a1a1a]">
                        {hg.headers.map((h) => (
                          <th key={h.id} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {summaryTable.getRowModel().rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-zinc-500">
                          無彙總資料。
                        </td>
                      </tr>
                    ) : (
                      summaryTable.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="border-b border-[#222] hover:bg-[#1a1a1a]/80">
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-4 py-3 align-middle text-zinc-200">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </BackendShell>
  );
}
