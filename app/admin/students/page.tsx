"use client";

/*
 * Admin — student grid (TanStack Table + demo-state). CSV buttons delegate to backend
 * (PostgreSQL). Table: column visibility, sorting, global search.
 */

import { useMemo, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState
} from "@tanstack/react-table";
import { useDemoState, type DemoStudent } from "../../../lib/demo-state";
import { downloadCsv, uploadCsv } from "../../../lib/api";

const COLUMN_LABELS: Record<string, string> = {
  name: "姓名",
  phone: "電話",
  remainingCredits: "餘額",
  trainingRatio: "課程",
  membershipType: "類型",
  actions: "操作"
};

export default function AdminStudentsPage() {
  const { students, updateStudent, deleteStudent } = useDemoState();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const blob =
        `${s.name} ${s.phone} ${s.remainingCredits} ${s.trainingRatio ?? ""} ${s.membershipType ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [students, search]);

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
      const r = (await uploadCsv("/api/admin/students/import", file)) as {
        imported?: number;
        updated?: number;
        skipped?: number;
      };
      const imp = r.imported ?? 0;
      const upd = r.updated ?? 0;
      const sk = r.skipped ?? 0;
      setStatus(
        `後端匯入完成：新增 ${imp} 筆 · 更新 ${upd} 筆（同姓名會覆寫）· 略過 ${sk} 筆。請重新整理或從後台拉資料以同步畫面。`
      );
    } catch (e) {
      setStatus(String(e));
    }
  }

  const columnHelper = createColumnHelper<DemoStudent>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        id: "name",
        header: "姓名",
        enableSorting: true,
        sortingFn: "alphanumeric",
        cell: (info) => {
          const row = info.row.original;
          if (editingId === row.id) {
            return (
              <input
                defaultValue={row.name}
                className="w-full rounded-md border border-slate-500 bg-white px-2 py-1 text-slate-950"
                onBlur={(e) => updateStudent(row.id, { name: e.target.value })}
              />
            );
          }
          return <span className="font-medium">{info.getValue()}</span>;
        }
      }),
      columnHelper.accessor("phone", {
        id: "phone",
        header: "電話",
        enableSorting: true,
        sortingFn: "alphanumeric"
      }),
      columnHelper.accessor("remainingCredits", {
        id: "remainingCredits",
        header: "餘額",
        enableSorting: true,
        sortingFn: "basic"
      }),
      columnHelper.accessor("trainingRatio", {
        id: "trainingRatio",
        header: "課程",
        enableSorting: true,
        sortingFn: "alphanumeric",
        cell: (info) => (
          <span className="rounded-full border border-violet-400/50 bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-100">
            {info.getValue() ?? "—"}
          </span>
        )
      }),
      columnHelper.accessor("membershipType", {
        id: "membershipType",
        header: "類型",
        enableSorting: true,
        sortingFn: "alphanumeric",
        cell: (info) => (info.getValue() === "renewal" ? "Renewal" : "New")
      }),
      columnHelper.display({
        id: "actions",
        header: "操作",
        enableHiding: false,
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          const editing = editingId === row.id;
          return (
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-500 bg-slate-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-600"
                onClick={() => setEditingId(editing ? null : row.id)}
              >
                {editing ? "完成" : "編輯"}
              </button>
              <button
                type="button"
                className="rounded-md border border-red-400 bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-500"
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
    data: filteredStudents,
    columns,
    state: {
      sorting,
      columnVisibility
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-emerald-400 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
            onClick={() => void exportStudentsCsvBackend()}
          >
            匯出 students.csv（後端）
          </button>
          <label className="cursor-pointer rounded-lg border border-violet-400 bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-500">
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
            className="min-w-[220px] rounded-lg border border-slate-500 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-500 shadow-sm"
          />
        </div>

        <div className="rounded-lg border border-[#374151] bg-[#0b1220] p-3">
          <p className="mb-2 text-xs font-medium text-slate-400">顯示欄位（加／減 column）</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-200">
            {table.getAllLeafColumns().map((column) => {
              if (!column.getCanHide()) return null;
              const id = column.id;
              return (
                <label key={id} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-500 accent-emerald-500"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                  />
                  <span>{COLUMN_LABELS[id] ?? id}</span>
                </label>
              );
            })}
          </div>
        </div>

        {status && <p className="text-sm text-emerald-300">{status}</p>}
        <div className="overflow-x-auto rounded-lg border border-[#374151] bg-[#0b1220]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#374151] text-slate-300">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="whitespace-nowrap px-3 py-2">
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm font-semibold !text-white shadow-sm hover:bg-slate-700 ${
                            header.column.getCanSort()
                              ? "cursor-pointer select-none"
                              : "cursor-default"
                          }`}
                          onClick={
                            header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined
                          }
                          disabled={!header.column.getCanSort()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: " ▲",
                            desc: " ▼"
                          }[(header.column.getIsSorted() as string) ?? ""] ?? null}
                        </button>
                      )}
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
