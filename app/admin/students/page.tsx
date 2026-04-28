"use client";

/*
 * Admin — student grid (TanStack Table + demo-state). CSV buttons delegate to backend or
 * same-origin mock — table rows stay client demo until wired to live APIs.
 */

import { useMemo, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable
} from "@tanstack/react-table";
import { useDemoState, type DemoStudent } from "../../../lib/demo-state";
import { downloadCsv, uploadCsv } from "../../../lib/api";

export default function AdminStudentsPage() {
  const { students, addStudent, updateStudent, deleteStudent } = useDemoState();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.remainingCredits > 0).length;

  async function exportStudentsCsvBackend() {
    try {
      await downloadCsv("/api/admin/students/export.csv", "students.csv");
      setStatus("已從後端匯出 students.csv（PostgreSQL / zomate_fs_students）。");
    } catch (e) {
      setStatus(
        `${e} — 請確認已設定 NEXT_PUBLIC_API_BASE_URL 指向 FastAPI，並已登入（Bearer）。`
      );
    }
  }

  async function importStudentsCsvBackend(file: File) {
    try {
      const r = await uploadCsv("/api/admin/students/import", file);
      setStatus(`後端匯入完成：${r.imported ?? 0} 筆（略過 ${r.skipped ?? 0}）。請重新整理或從後台拉資料以同步畫面。`);
    } catch (e) {
      setStatus(String(e));
    }
  }

  const columnHelper = createColumnHelper<DemoStudent>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "姓名",
        cell: (info) => {
          const row = info.row.original;
          if (editingId === row.id) {
            return (
              <input
                defaultValue={row.name}
                onBlur={(e) => updateStudent(row.id, { name: e.target.value })}
              />
            );
          }
          return <span className="font-medium">{info.getValue()}</span>;
        }
      }),
      columnHelper.accessor("phone", { header: "電話" }),
      columnHelper.accessor("remainingCredits", { header: "餘額" }),
      columnHelper.accessor("membershipType", {
        header: "類型",
        cell: (info) => (info.getValue() === "renewal" ? "Renewal" : "New")
      }),
      columnHelper.display({
        id: "actions",
        header: "操作",
        cell: (info) => {
          const row = info.row.original;
          const editing = editingId === row.id;
          return (
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingId(editing ? null : row.id)}>
                {editing ? "完成" : "編輯"}
              </button>
              <button
                type="button"
                className="bg-red-600 text-white hover:bg-red-500"
                onClick={() => deleteStudent(row.id)}
              >
                刪除
              </button>
            </div>
          );
        }
      })
    ],
    [columnHelper, deleteStudent, editingId, updateStudent]
  );

  const table = useReactTable({
    data: students,
    columns,
    state: {
      globalFilter: search
    },
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel()
  });

  return (
    <BackendShell title="學生管理">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">學生名單</h2>
        <p className="text-sm text-slate-300">
          TanStack Table（示範資料）· CSV 匯入／匯出請用後端 FastAPI →{" "}
          <code className="text-xs">zomate_fs_students</code>
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[#374151] bg-[#111827] p-3">
            <p className="text-xs text-slate-400">總學生數</p>
            <p className="text-2xl font-semibold text-white">{totalStudents}</p>
          </div>
          <div className="rounded-lg border border-[#374151] bg-[#111827] p-3">
            <p className="text-xs text-slate-400">活躍學生</p>
            <p className="text-2xl font-semibold text-white">{activeStudents}</p>
          </div>
          <div className="rounded-lg border border-[#374151] bg-[#111827] p-3">
            <p className="text-xs text-slate-400">Data Growth</p>
            <p className="text-2xl font-semibold text-emerald-300">+{Math.max(0, totalStudents - 10)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void exportStudentsCsvBackend()}>
            匯出 students.csv（後端）
          </button>
          <label className="cursor-pointer rounded-md border border-[#333] px-3 py-2 text-sm text-slate-200">
            匯入 CSV（後端）
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                await importStudentsCsvBackend(file);
                ev.target.value = "";
              }}
            />
          </label>
          <input
            placeholder="搜尋姓名 / 電話"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[220px]"
          />
        </div>
        {status && <p className="text-sm text-emerald-300">{status}</p>}
        <div className="overflow-x-auto rounded-lg border border-[#374151] bg-[#0b1220]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#374151] text-slate-300">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-3 py-2">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-[#1f2937] text-slate-200">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </BackendShell>
  );
}
