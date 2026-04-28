"use client";

/** @feature [F04.3][F04.5] */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from "@tanstack/react-table";
import BackendShell from "../../../../components/backend-shell";
import { api } from "../../../../lib/api";
import { exportRowsToExcelSheet } from "../../../../lib/excel-export";

type CoachRow = {
  coachName: string;
  month: string;
  classesTaught: number;
  hoursOnFloor: number;
  grossPayHkd: number;
};

export default function AdminFinancePayrollPage() {
  const [rows, setRows] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = (await api.reportsCoachAttendance()) as { rows?: CoachRow[] };
      setRows(Array.isArray(json.rows) ? json.rows : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<ColumnDef<CoachRow>[]>(
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

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  async function exportExcel() {
    const cols = [
      { header: "月份", key: "month" },
      { header: "教練", key: "coachName" },
      { header: "堂數", key: "classesTaught" },
      { header: "Floor 時數", key: "hoursOnFloor" },
      { header: "薪酬 (HKD)", key: "grossPayHkd" }
    ];
    await exportRowsToExcelSheet({
      filename: `coach-attendance-${new Date().toISOString().slice(0, 10)}`,
      sheetName: "Coach attendance",
      columns: cols,
      rows: rows as Record<string, unknown>[]
    });
  }

  return (
    <BackendShell title="薪酬 / 出勤報表">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Membership & Coach Attendance</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Mock：<code className="rounded bg-[#262626] px-1 py-0.5 text-xs">GET /api/v1/reports/coach-attendance</code>
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-sm text-zinc-100 hover:bg-[#262626]"
            onClick={() => void exportExcel()}
          >
            Export Excel (WYSIWYG)
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">載入中…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.1] bg-[#141414]">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
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
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-[#222] hover:bg-[#1a1a1a]/80">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle text-zinc-200">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </BackendShell>
  );
}
