"use client";

/** @feature [F03.5][F04.5] */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sessionLedgerEntrySchema } from "../../../../lib/schemas/report";
import type { SessionLedgerEntryValidated } from "../../../../lib/schemas/report";
import { api } from "../../../../lib/api";
import { exportRowsToExcelSheet } from "../../../../lib/excel-export";
import BackendShell from "../../../../components/backend-shell";

type LedgerApi = { entries: SessionLedgerEntryValidated[] };

export default function SessionLedgerPage() {
  const [entries, setEntries] = useState<SessionLedgerEntryValidated[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = (await api.sessionLedgerGet()) as LedgerApi;
      setEntries(Array.isArray(json.entries) ? json.entries : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const form = useForm<SessionLedgerEntryValidated>({
    resolver: zodResolver(sessionLedgerEntrySchema),
    defaultValues: {
      studentName: "",
      sessionStartIso: new Date().toISOString().slice(0, 16),
      cancelledAtIso: "",
      reason: "late_cancel",
      notes: ""
    }
  });

  const columns = useMemo<ColumnDef<SessionLedgerEntryValidated>[]>(
    () => [
      { accessorKey: "studentName", header: "學員" },
      {
        accessorKey: "sessionStartIso",
        header: "課堂開始",
        cell: (c) => new Date(String(c.getValue())).toLocaleString()
      },
      {
        accessorKey: "cancelledAtIso",
        header: "取消時間",
        cell: (c) => (c.getValue() ? new Date(String(c.getValue())).toLocaleString() : "—")
      },
      { accessorKey: "reason", header: "原因" },
      { accessorKey: "notes", header: "備註" }
    ],
    []
  );

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  async function exportExcel() {
    const cols = [
      { header: "學員", key: "studentName" },
      { header: "課堂開始", key: "sessionStartIso" },
      { header: "取消時間", key: "cancelledAtIso" },
      { header: "原因", key: "reason" },
      { header: "備註", key: "notes" }
    ];
    await exportRowsToExcelSheet({
      filename: `session-ledger-${new Date().toISOString().slice(0, 10)}`,
      sheetName: "Ledger",
      columns: cols,
      rows: entries.map((e) => ({
        studentName: e.studentName,
        sessionStartIso: e.sessionStartIso,
        cancelledAtIso: e.cancelledAtIso ?? "",
        reason: e.reason,
        notes: e.notes ?? ""
      })) as Record<string, unknown>[]
    });
  }

  async function onAppend(data: SessionLedgerEntryValidated) {
    setMsg("");
    try {
      await api.sessionLedgerPost({
        studentName: data.studentName,
        sessionStartIso: data.sessionStartIso,
        cancelledAtIso:
          data.reason === "late_cancel" && data.cancelledAtIso?.trim()
            ? new Date(data.cancelledAtIso).toISOString()
            : undefined,
        reason: data.reason,
        notes: data.notes?.trim() || undefined
      });
      setMsg("已紀錄。");
      form.reset({
        studentName: "",
        sessionStartIso: new Date().toISOString().slice(0, 16),
        cancelledAtIso: "",
        reason: "late_cancel",
        notes: ""
      });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <BackendShell title="Session Ledger">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Session Ledger · 扣堂原因</h2>
            <p className="mt-1 text-sm text-zinc-500">
              24 小時內逾時取消會標記為 late_cancel（終端會輸出規則提示）。
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

        <form
          className="space-y-3 rounded-xl border border-white/[0.12] bg-[#141414] p-5"
          onSubmit={form.handleSubmit(onAppend)}
        >
          <h3 className="text-sm font-semibold text-white">新增紀錄（示範）</h3>
          <input placeholder="學員姓名" {...form.register("studentName")} />
          <label className="block text-xs text-zinc-500">課堂開始（datetime-local）</label>
          <input type="datetime-local" {...form.register("sessionStartIso")} />
          <select {...form.register("reason")}>
            <option value="attended">正常上課 attended</option>
            <option value="late_cancel">逾時取消 late_cancel（24h 規則）</option>
            <option value="coach_makeup">教練補課 coach_makeup</option>
          </select>
          {form.watch("reason") === "late_cancel" ? (
            <>
              <label className="block text-xs text-zinc-500">取消時間（用以判定是否 24h 內）</label>
              <input type="datetime-local" {...form.register("cancelledAtIso")} />
            </>
          ) : null}
          <textarea placeholder="備註" rows={2} {...form.register("notes")} />
          <button type="submit" className="bg-[#6366f1] text-white hover:bg-[#535bf0]">
            提交
          </button>
          {msg && <p className="text-sm text-emerald-400">{msg}</p>}
        </form>
      </div>
    </BackendShell>
  );
}
