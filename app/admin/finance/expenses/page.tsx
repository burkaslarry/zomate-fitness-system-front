"use client";

/** @feature [F04.2][F04.4][F04.5] */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import BackendShell from "../../../../components/backend-shell";
import { expenseEntryFormSchema } from "../../../../lib/schemas/report";
import type { ExpenseRowValidated } from "../../../../lib/schemas/report";
import { api } from "../../../../lib/api";
import { exportRowsToExcelSheet } from "../../../../lib/excel-export";

export default function AdminFinanceExpensesPage() {
  const [rows, setRows] = useState<ExpenseRowValidated[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = (await api.reportsExpenses()) as { rows?: ExpenseRowValidated[] };
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

  const form = useForm({
    resolver: zodResolver(expenseEntryFormSchema),
    defaultValues: {
      category: "Rent" as const,
      amount: 1,
      date: new Date().toISOString().slice(0, 10),
      memo: "",
      invoiceRef: ""
    }
  });

  const columns = useMemo<ColumnDef<ExpenseRowValidated>[]>(
    () => [
      { accessorKey: "date", header: "日期" },
      { accessorKey: "category", header: "類別" },
      {
        accessorKey: "amount",
        header: "金額 (HKD)",
        cell: (c) => Number(c.getValue()).toLocaleString()
      },
      { accessorKey: "memo", header: "備註" },
      { accessorKey: "invoiceRef", header: "發票／單號" }
    ],
    []
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  async function exportExcel() {
    const cols = [
      { header: "日期", key: "date" },
      { header: "類別", key: "category" },
      { header: "金額 (HKD)", key: "amount" },
      { header: "備註", key: "memo" },
      { header: "發票／單號", key: "invoiceRef" }
    ];
    await exportRowsToExcelSheet({
      filename: `expenses-${new Date().toISOString().slice(0, 10)}`,
      sheetName: "Expenses",
      columns: cols,
      rows: rows.map((r) => ({
        date: r.date,
        category: r.category,
        amount: r.amount,
        memo: r.memo ?? "",
        invoiceRef: r.invoiceRef ?? ""
      })) as Record<string, unknown>[]
    });
  }

  async function onSubmit(data: Record<string, unknown>) {
    setStatus("");
    try {
      await api.postExpenseEntry(data);
      setStatus("已入機。");
      form.reset();
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);

  return (
    <BackendShell title="支出管理">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">支出管理 · Expenses</h2>
          </div>
          <button
            type="button"
            className="rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink hover:bg-surface"
            onClick={() => void exportExcel()}
          >
            Export Excel (WYSIWYG)
          </button>
        </div>

        <p className="rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] px-4 py-3 text-sm text-zinc-300">
          Total Expenses (loaded): HKD {total.toLocaleString()}
        </p>

        {loading ? (
          <p className="text-sm text-zinc-500">載入中…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-ink/[0.08] bg-canvas">
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
                  <tr key={row.id} className="border-b border-ink/[0.08] hover:bg-canvas/80">
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

        <form className="grid gap-3 rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-5 md:grid-cols-4" onSubmit={form.handleSubmit(onSubmit)}>
          <select {...form.register("category")}>
            <option value="Rent">Rent</option>
            <option value="Staff">Staff</option>
            <option value="Utilities">Utilities</option>
            <option value="Equipment">Equipment</option>
            <option value="Other">Other</option>
          </select>
          <input type="number" step="0.01" {...form.register("amount", { valueAsNumber: true })} placeholder="Amount" />
          <input type="date" {...form.register("date")} />
          <input {...form.register("invoiceRef")} placeholder="發票編號（入機）" />
          <textarea className="md:col-span-4" rows={2} {...form.register("memo")} placeholder="備註" />
          <button type="submit" className="md:col-span-4 rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-primary">
            新增支出（POST）
          </button>
          {status && <p className="md:col-span-4 text-sm text-emerald-700">{status}</p>}
        </form>
      </div>
    </BackendShell>
  );
}
