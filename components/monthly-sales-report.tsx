"use client";

/** @feature [F04.1][F04.5] */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  type Table,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Loader2, Search } from "lucide-react";
import { api } from "../lib/api";
import { csvRow } from "../lib/csv-rfc4180";
import { exportRowsToExcelSheet } from "../lib/excel-export";
import {
  SALES_REPORT_COLUMN_IDS,
  type CourseSaleRow,
  type MonthlySalesReportApiResponse,
  type SalesReportColumnId
} from "../lib/types/monthly-sales-report";

const COLUMN_LABELS: Record<SalesReportColumnId, string> = {
  date: "Date",
  clientName: "Client",
  courseType: "Course",
  amount: "Amount (HKD)",
  coachName: "Coach",
  paymentStatus: "Status",
  installmentStatus: "Installment"
};

function normalizeRows(json: unknown): CourseSaleRow[] {
  if (Array.isArray(json)) return json as CourseSaleRow[];
  if (!json || typeof json !== "object") return [];
  const o = json as MonthlySalesReportApiResponse;
  if (Array.isArray(o.rows)) return o.rows;
  if (Array.isArray(o.data)) return o.data;
  if (Array.isArray(o.content)) return o.content;
  if (Array.isArray(o.items)) return o.items;
  return [];
}

function encodeSortParam(sorting: SortingState): string | undefined {
  if (!sorting.length) return undefined;
  return sorting.map((s) => `${String(s.id)}:${s.desc ? "desc" : "asc"}`).join(",");
}

function encodeColumnsParam(visibility: VisibilityState): string | undefined {
  const visible = SALES_REPORT_COLUMN_IDS.filter((id) => visibility[id] !== false);
  if (visible.length === SALES_REPORT_COLUMN_IDS.length) return undefined;
  return visible.join(",");
}

function formatSaleDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatCurrencyHkd(amount: number) {
  if (typeof amount !== "number" || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "HKD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

/** Same strings as rendered cells — Excel / CSV exports must match the grid (WYSIWYG). */
function formatSalesReportExportValue(id: SalesReportColumnId, row: CourseSaleRow): string {
  switch (id) {
    case "date":
      return formatSaleDate(row.date);
    case "amount":
      return formatCurrencyHkd(Number(row.amount));
    case "installmentStatus":
      return String(row.installmentStatus ?? "—");
    case "clientName":
    case "courseType":
    case "coachName":
    case "paymentStatus":
      return String(row[id] ?? "—");
    default:
      return String((row as unknown as Record<string, unknown>)[id] ?? "—");
  }
}

function visibleSalesColumnIds(table: Table<CourseSaleRow>): SalesReportColumnId[] {
  return table
    .getVisibleLeafColumns()
    .map((c) => String(c.id))
    .filter((id): id is SalesReportColumnId =>
      (SALES_REPORT_COLUMN_IDS as readonly string[]).includes(id)
    );
}

function statusBadgeClass(status: string) {
  const s = status.toUpperCase();
  if (s.includes("PAID") || s.includes("COMPLETE")) {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }
  if (s.includes("PEND") || s.includes("PARTIAL")) {
    return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  }
  if (s.includes("OVERDUE") || s.includes("FAIL")) {
    return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  }
  if (s.includes("REFUND")) {
    return "border-slate-500/50 bg-slate-500/10 text-slate-200";
  }
  return "border-[#3a3a3a] bg-[#222] text-[#d4d4d4]";
}

function HeaderButton({
  label,
  sorted
}: {
  label: string;
  sorted: false | "asc" | "desc";
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {sorted === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      ) : sorted === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
      )}
    </span>
  );
}

export default function MonthlySalesReport() {
  const [data, setData] = useState<CourseSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "clientName", desc: false }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);

  const sortQuery = useMemo(() => encodeSortParam(sorting), [sorting]);
  const columnsQuery = useMemo(() => encodeColumnsParam(columnVisibility), [columnVisibility]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!columnMenuRef.current?.contains(e.target as Node)) {
        setColumnMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .reportsSales({ sort: sortQuery, columns: columnsQuery })
      .then((json) => {
        if (cancelled) return;
        setData(normalizeRows(json));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sortQuery, columnsQuery]);

  const columns = useMemo<ColumnDef<CourseSaleRow, unknown>[]>(
    () => [
      {
        accessorKey: "date",
        id: "date",
        header: ({ column }) => (
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-slate-600/80 bg-slate-800 px-2 py-1.5 text-left text-sm font-medium !text-white shadow-none hover:bg-slate-700 hover:!text-white"
            onClick={() => column.toggleSorting()}
          >
            <HeaderButton label={COLUMN_LABELS.date} sorted={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => (
          <span className="whitespace-nowrap text-slate-200">{formatSaleDate(String(info.getValue()))}</span>
        ),
        enableSorting: true
      },
      {
        accessorKey: "clientName",
        id: "clientName",
        header: ({ column }) => (
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-slate-600/80 bg-slate-800 px-2 py-1.5 text-left text-sm font-medium !text-white shadow-none hover:bg-slate-700 hover:!text-white"
            onClick={() => column.toggleSorting()}
          >
            <HeaderButton label={COLUMN_LABELS.clientName} sorted={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => <span className="text-slate-200">{String(info.getValue() ?? "—")}</span>,
        enableSorting: true
      },
      {
        accessorKey: "courseType",
        id: "courseType",
        header: ({ column }) => (
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-slate-600/80 bg-slate-800 px-2 py-1.5 text-left text-sm font-medium !text-white shadow-none hover:bg-slate-700 hover:!text-white"
            onClick={() => column.toggleSorting()}
          >
            <HeaderButton label={COLUMN_LABELS.courseType} sorted={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => <span className="text-slate-200">{String(info.getValue() ?? "—")}</span>,
        enableSorting: true
      },
      {
        accessorKey: "amount",
        id: "amount",
        header: ({ column }) => (
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-slate-600/80 bg-slate-800 px-2 py-1.5 text-left text-sm font-medium !text-white shadow-none hover:bg-slate-700 hover:!text-white"
            onClick={() => column.toggleSorting()}
          >
            <HeaderButton label={COLUMN_LABELS.amount} sorted={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => (
          <span className="tabular-nums text-slate-100">{formatCurrencyHkd(Number(info.getValue()))}</span>
        ),
        enableSorting: true
      },
      {
        accessorKey: "coachName",
        id: "coachName",
        header: ({ column }) => (
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-slate-600/80 bg-slate-800 px-2 py-1.5 text-left text-sm font-medium !text-white shadow-none hover:bg-slate-700 hover:!text-white"
            onClick={() => column.toggleSorting()}
          >
            <HeaderButton label={COLUMN_LABELS.coachName} sorted={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => <span className="text-slate-200">{String(info.getValue() ?? "—")}</span>,
        enableSorting: true
      },
      {
        accessorKey: "paymentStatus",
        id: "paymentStatus",
        header: ({ column }) => (
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-slate-600/80 bg-slate-800 px-2 py-1.5 text-left text-sm font-medium !text-white shadow-none hover:bg-slate-700 hover:!text-white"
            onClick={() => column.toggleSorting()}
          >
            <HeaderButton label={COLUMN_LABELS.paymentStatus} sorted={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => {
          const raw = String(info.getValue() ?? "—");
          return (
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(raw)}`}
            >
              {raw}
            </span>
          );
        },
        enableSorting: true
      },
      {
        accessorKey: "installmentStatus",
        id: "installmentStatus",
        header: ({ column }) => (
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-slate-600/80 bg-slate-800 px-2 py-1.5 text-left text-sm font-medium !text-white shadow-none hover:bg-slate-700 hover:!text-white"
            onClick={() => column.toggleSorting()}
          >
            <HeaderButton label={COLUMN_LABELS.installmentStatus} sorted={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => (
          <span className="text-slate-300">{String(info.getValue() ?? "—")}</span>
        ),
        enableSorting: true
      }
    ],
    []
  );

  const globalFilterFn = useCallback(
    (row: { original: CourseSaleRow }, _columnId: string, filterValue: unknown) => {
      const q = String(filterValue ?? "")
        .trim()
        .toLowerCase();
      if (!q) return true;
      const r = row.original;
      return (
        r.clientName.toLowerCase().includes(q) ||
        r.courseType.toLowerCase().includes(q) ||
        r.coachName.toLowerCase().includes(q) ||
        r.paymentStatus.toLowerCase().includes(q) ||
        (r.installmentStatus ?? "").toLowerCase().includes(q) ||
        formatSaleDate(r.date).toLowerCase().includes(q) ||
        String(r.amount).includes(q)
      );
    },
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualSorting: true,
    enableSortingRemoval: true,
    globalFilterFn,
    sortDescFirst: false
  });

  const rowCount = table.getRowModel().rows.length;
  const filteredEmpty = !loading && !error && data.length > 0 && rowCount === 0;
  const totallyEmpty = !loading && !error && data.length === 0;

  /** Rows / columns match the filtered grid row order (API sort + client search filter). */
  function buildWysiwygExportPayload() {
    const ids = visibleSalesColumnIds(table);
    const cols = ids.map((id) => ({
      header: COLUMN_LABELS[id],
      key: id
    }));
    const rows = table.getFilteredRowModel().rows.map((r) => {
      const flat: Record<string, string> = {};
      ids.forEach((id) => {
        flat[id] = formatSalesReportExportValue(id, r.original);
      });
      return flat;
    });
    return { ids, cols, rows };
  }

  async function exportExcel() {
    const { cols, rows } = buildWysiwygExportPayload();
    await exportRowsToExcelSheet({
      filename: `sales-export-${new Date().toISOString().slice(0, 10)}`,
      sheetName: "Sales",
      columns: cols,
      rows
    });
  }

  function exportCsv() {
    const { ids, rows } = buildWysiwygExportPayload();
    const headers = ids.map((id) => COLUMN_LABELS[id]);
    const lines = [
      csvRow(headers),
      ...rows.map((r) => csvRow(ids.map((id) => r[id] ?? "")))
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}\n`], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-[#2b2b2b] pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Monthly sales report</h2>
          <p className="mt-1 text-sm text-slate-400">
            Sort / visible columns sync to{" "}
            <code className="rounded bg-[#262626] px-1 py-0.5 text-xs text-slate-300">/api/v1/reports/sales</code>.
            Excel &amp; CSV exports use the same rows and formatted values as the table below.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              className="w-full min-w-[220px] rounded-lg border border-[#333] bg-[#141414] py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 sm:w-64"
              placeholder="Search clients, courses, coaches…"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              aria-label="Filter rows"
            />
          </div>
          <button
            type="button"
            disabled={rowCount === 0}
            onClick={() => void exportExcel()}
            className="inline-flex w-full items-center justify-center rounded-lg border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-sm font-medium text-slate-100 hover:border-slate-500 hover:bg-[#262626] enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            Export Excel (WYSIWYG)
          </button>
          <button
            type="button"
            disabled={rowCount === 0}
            onClick={() => exportCsv()}
            className="inline-flex w-full items-center justify-center rounded-lg border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-sm font-medium text-slate-100 hover:border-slate-500 hover:bg-[#262626] enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            Export CSV (WYSIWYG)
          </button>
          <div className="relative" ref={columnMenuRef}>
            <button
              type="button"
              onClick={() => setColumnMenuOpen((o) => !o)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-sm font-medium text-slate-100 hover:border-slate-500 hover:bg-[#262626] sm:w-auto"
            >
              <Columns3 className="h-4 w-4" aria-hidden />
              Columns
            </button>
            {columnMenuOpen ? (
              <div
                className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-[#333] bg-[#171717] p-2 shadow-xl"
                role="menu"
              >
                <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Visible</p>
                <ul className="max-h-64 space-y-1 overflow-auto">
                  {SALES_REPORT_COLUMN_IDS.map((id) => (
                    <li key={id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-200 hover:bg-[#222]">
                        <input
                          type="checkbox"
                          className="rounded border-[#444] bg-[#111] text-violet-500 focus:ring-violet-500"
                          checked={columnVisibility[id] !== false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (!checked) {
                              const visibleCount = SALES_REPORT_COLUMN_IDS.filter(
                                (colId) => (colId === id ? false : columnVisibility[colId] !== false)
                              ).length;
                              if (visibleCount < 1) return;
                            }
                            setColumnVisibility((prev) => ({
                              ...prev,
                              [id]: checked
                            }));
                          }}
                        />
                        {COLUMN_LABELS[id]}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          <p className="font-medium">Could not load report</p>
          <p className="mt-1 text-rose-100/80">{error}</p>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-xl border border-[#2b2b2b] bg-[#141414]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading sales…
          </div>
        ) : totallyEmpty ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-medium text-slate-200">No sales for this period</p>
            <p className="mt-2 text-sm text-slate-500">Try another month on the backend or adjust filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-[#2b2b2b] bg-[#1a1a1a]">
                      {hg.headers.map((header) => (
                        <th key={header.id} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {filteredEmpty ? (
                    <tr>
                      <td
                        colSpan={Math.max(1, table.getVisibleLeafColumns().length)}
                        className="px-4 py-12 text-center text-slate-400"
                      >
                        No rows match &ldquo;{globalFilter}&rdquo;. Clear the search to see all loaded sales.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-[#222] last:border-0 hover:bg-[#1a1a1a]/80"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#2b2b2b] px-4 py-3 text-xs text-slate-500">
              <span>
                Showing {filteredEmpty ? 0 : rowCount} of {data.length} loaded row{data.length === 1 ? "" : "s"}
              </span>
              <span className="tabular-nums">
                Sort: <span className="text-slate-300">{sortQuery ?? "default"}</span>
                {columnsQuery ? (
                  <>
                    {" · "}
                    Columns: <span className="text-slate-300">{columnsQuery}</span>
                  </>
                ) : null}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
