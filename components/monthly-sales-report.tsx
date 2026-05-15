"use client";

/**
 * [F004][S001]
 * Feature: Admin Reports & Financials
 * Step: (see Logic)
 * Logic: Finance and reports UI: sales, expenses, payroll.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Search } from "lucide-react";
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

/** Checkbox rows in the export-columns modal (visual grouping). */
const EXPORT_COLUMN_ROWS: SalesReportColumnId[][] = [
  ["date", "clientName", "courseType", "amount"],
  ["coachName", "paymentStatus", "installmentStatus"]
];

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

function rowHasInstallmentEnrollment(r: CourseSaleRow): boolean {
  const inst = String(r.installmentStatus ?? "")
    .trim()
    .toUpperCase();
  if (inst && inst !== "NONE" && inst !== "—" && inst !== "-") return true;
  const pay = String(r.paymentStatus ?? "").toUpperCase();
  if (pay.includes("INSTALLMENT")) return true;
  return false;
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

/** Same strings as rendered cells — Excel / CSV exports match the on-screen table. */
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
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800";
  }
  if (s.includes("PEND") || s.includes("PARTIAL")) {
    return "border-amber-500/40 bg-amber-500/10 text-amber-900";
  }
  if (s.includes("OVERDUE") || s.includes("FAIL")) {
    return "border-rose-500/40 bg-rose-500/10 text-rose-800";
  }
  if (s.includes("REFUND")) {
    return "border-slate-500/50 bg-slate-500/10 text-ink/80";
  }
  return "border-ink/15 bg-canvas text-ink/80";
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
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] py-16 text-ink/55">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading sales…
        </div>
      }
    >
      <MonthlySalesReportImpl />
    </Suspense>
  );
}

function MonthlySalesReportImpl() {
  const [data, setData] = useState<CourseSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "clientName", desc: false }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  /** Native <dialog> proved flaky; use fixed overlay so demo always shows on localhost + prod. */
  const [visibleColumnsModalOpen, setVisibleColumnsModalOpen] = useState(false);
  const [columnPickerSource, setColumnPickerSource] = useState<"courseType" | "installmentStatus" | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);

  const installmentEnrollmentOnlyActive = useMemo(
    () =>
      searchParams.get("installment_enrollment") === "1" || searchParams.get("installment") === "1",
    [searchParams]
  );

  const qParam = searchParams.get("q");
  useEffect(() => {
    if (qParam !== null) setGlobalFilter(qParam);
  }, [qParam]);

  useEffect(() => {
    if (!installmentEnrollmentOnlyActive) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 150);
    return () => window.clearTimeout(t);
  }, [installmentEnrollmentOnlyActive]);

  const clearInstallmentEnrollmentPreset = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("installment_enrollment");
    sp.delete("installment");
    const next = sp.toString();
    router.push(next ? `${pathname}?${next}` : pathname);
  }, [pathname, router, searchParams]);

  const closeVisibleColumnsModal = useCallback(() => {
    setVisibleColumnsModalOpen(false);
    setColumnPickerSource(null);
  }, []);

  const openVisibleColumnsModal = useCallback((sortSource: "courseType" | "installmentStatus" | null) => {
    setColumnPickerSource(sortSource);
    setVisibleColumnsModalOpen(true);
  }, []);

  const sortPickerSourceColumn = useCallback(
    (desc: boolean) => {
      const id = columnPickerSource;
      if (!id) return;
      setSorting([{ id, desc }]);
      closeVisibleColumnsModal();
    },
    [columnPickerSource, closeVisibleColumnsModal]
  );

  function setSalesColumnVisible(columnId: SalesReportColumnId, checked: boolean) {
    setColumnVisibility((prev) => {
      if (!checked) {
        const visibleCount = SALES_REPORT_COLUMN_IDS.filter((colId) => {
          if (colId === columnId) return false;
          return prev[colId] !== false;
        }).length;
        if (visibleCount < 1) return prev;
      }
      return { ...prev, [columnId]: checked };
    });
  }

  const sortQuery = useMemo(() => encodeSortParam(sorting), [sorting]);
  const columnsQuery = useMemo(() => encodeColumnsParam(columnVisibility), [columnVisibility]);

  useEffect(() => {
    if (!visibleColumnsModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeVisibleColumnsModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibleColumnsModalOpen, closeVisibleColumnsModal]);

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
            className="flex w-full items-center gap-1 rounded-md border border-ink/12 bg-surface px-2 py-1.5 text-left text-sm font-medium text-ink shadow-none hover:bg-canvas"
            onClick={() => column.toggleSorting()}
          >
            <HeaderButton label={COLUMN_LABELS.date} sorted={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => (
          <span className="whitespace-nowrap text-ink/80">{formatSaleDate(String(info.getValue()))}</span>
        ),
        enableSorting: true
      },
      {
        accessorKey: "clientName",
        id: "clientName",
        header: ({ column }) => (
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-ink/12 bg-surface px-2 py-1.5 text-left text-sm font-medium text-ink shadow-none hover:bg-canvas"
            onClick={() => column.toggleSorting()}
          >
            <HeaderButton label={COLUMN_LABELS.clientName} sorted={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => <span className="text-ink/80">{String(info.getValue() ?? "—")}</span>,
        enableSorting: true
      },
      {
        accessorKey: "courseType",
        id: "courseType",
        header: ({ column }) => (
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-ink/12 bg-surface px-2 py-1.5 text-left text-sm font-medium text-ink shadow-none hover:bg-canvas"
            onClick={() => openVisibleColumnsModal("courseType")}
          >
            <HeaderButton label={COLUMN_LABELS.courseType} sorted={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => <span className="text-ink/80">{String(info.getValue() ?? "—")}</span>,
        enableSorting: true
      },
      {
        accessorKey: "amount",
        id: "amount",
        header: ({ column }) => (
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-ink/12 bg-surface px-2 py-1.5 text-left text-sm font-medium text-ink shadow-none hover:bg-canvas"
            onClick={() => column.toggleSorting()}
          >
            <HeaderButton label={COLUMN_LABELS.amount} sorted={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => (
          <span className="tabular-nums text-ink">{formatCurrencyHkd(Number(info.getValue()))}</span>
        ),
        enableSorting: true
      },
      {
        accessorKey: "coachName",
        id: "coachName",
        header: ({ column }) => (
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-ink/12 bg-surface px-2 py-1.5 text-left text-sm font-medium text-ink shadow-none hover:bg-canvas"
            onClick={() => column.toggleSorting()}
          >
            <HeaderButton label={COLUMN_LABELS.coachName} sorted={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => <span className="text-ink/80">{String(info.getValue() ?? "—")}</span>,
        enableSorting: true
      },
      {
        accessorKey: "paymentStatus",
        id: "paymentStatus",
        header: ({ column }) => (
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-ink/12 bg-surface px-2 py-1.5 text-left text-sm font-medium text-ink shadow-none hover:bg-canvas"
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
            className="flex w-full items-center gap-1 rounded-md border border-ink/12 bg-surface px-2 py-1.5 text-left text-sm font-medium text-ink shadow-none hover:bg-canvas"
            onClick={() => openVisibleColumnsModal("installmentStatus")}
          >
            <HeaderButton label={COLUMN_LABELS.installmentStatus} sorted={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => (
          <span className="text-ink/70">{String(info.getValue() ?? "—")}</span>
        ),
        enableSorting: true
      }
    ],
    [openVisibleColumnsModal]
  );

  const globalFilterFn = useCallback(
    (row: { original: CourseSaleRow }, _columnId: string, filterValue: unknown) => {
      const r = row.original;
      if (installmentEnrollmentOnlyActive && !rowHasInstallmentEnrollment(r)) return false;
      const q = String(filterValue ?? "")
        .trim()
        .toLowerCase();
      if (!q) return true;
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
    [installmentEnrollmentOnlyActive]
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

  /** Rows / columns match the filtered table (API sort + client search filter). */
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
    <section className="-mt-0.5 space-y-4">
      {installmentEnrollmentOnlyActive ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 [html.light_&]:border-emerald-600/35 [html.light_&]:bg-emerald-50 [html.light_&]:text-emerald-950"
          role="status"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold [html.light_&]:text-emerald-900">已套用：</span>
            <span className="rounded-full border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium [html.light_&]:border-emerald-600/40 [html.light_&]:bg-emerald-100 [html.light_&]:text-emerald-900">
              有做分期嘅學生／enrolment
            </span>
            <button
              type="button"
              onClick={clearInstallmentEnrollmentPreset}
              className="text-xs font-semibold text-emerald-800 underline decoration-emerald-400/60 underline-offset-2 hover:text-ink [html.light_&]:text-emerald-800 [html.light_&]:hover:text-emerald-950"
            >
              關閉此篩選（顯示全部銷售列）
            </button>
          </div>
          <p className="text-xs text-emerald-900/85 [html.light_&]:text-emerald-900/80">
            右側「搜尋」可再輸入客戶名、課堂、教練或分期欄位關鍵字；亦可用網址參數{" "}
            <code className="rounded bg-canvas px-1 py-0.5 ring-1 ring-ink/10">?q=…</code>{" "}
            預填搜尋字。
          </p>
        </div>
      ) : null}

      <div className="space-y-4 border-b border-ink/10 pb-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-ink [html.light_&]:text-slate-900">
            Monthly sales report{" "}
            <span className="ml-2 rounded-md border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-sm font-semibold uppercase tracking-wide text-amber-900 [html.light_&]:border-amber-600/50 [html.light_&]:bg-amber-50 [html.light_&]:text-amber-900">
              (DEMO)
            </span>
          </h2>
          <p className="text-sm text-ink/55 [html.light_&]:text-slate-600">
            撳 <strong className="text-ink/70 [html.light_&]:text-slate-800">Columns to export</strong>{" "}
            或表頭 <strong className="text-ink/70 [html.light_&]:text-slate-800">Course</strong> /{" "}
            <strong className="text-ink/70 [html.light_&]:text-slate-800">Installment</strong> 可揀欄（後兩者會多顯示該欄 sort）。
            Sort / visibility sync to{" "}
            <code className="rounded bg-canvas px-1 py-0.5 text-xs text-ink/70 ring-1 ring-ink/10">/api/v1/reports/sales</code>
            ，Excel／CSV 與目前表格一致。
          </p>
        </div>

        {/* Columns trigger first — highest local stacking so it stays above the grid while interacting */}
        <div className="relative z-[100] flex flex-col gap-3">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-lg border-2 border-amber-400/80 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:border-amber-500 hover:bg-amber-100 hover:shadow-md active:scale-[0.99] [html.light_&]:border-amber-500/70"
            onClick={() => openVisibleColumnsModal(null)}
          >
            Columns to export
          </button>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
            <div className="relative md:col-span-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50"
                aria-hidden
              />
              <input
                ref={searchRef}
                type="search"
                className="w-full min-w-0 rounded-lg border border-ink/15 bg-canvas py-2 pr-3 pl-[2.25rem] text-sm text-ink shadow-sm ring-1 ring-ink/[0.04] placeholder:text-ink/45 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/35"
                placeholder={
                  installmentEnrollmentOnlyActive ? "再配合搜尋：客戶、課種、Coach、分期⋯" : "Search clients, courses, coaches…"
                }
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                aria-label="Filter rows"
              />
            </div>
            <button
              type="button"
              disabled={rowCount === 0}
              onClick={() => void exportExcel()}
              className="inline-flex min-h-[2.75rem] w-full items-center justify-center rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-medium text-ink shadow-sm ring-1 ring-ink/[0.04] hover:border-primary/40 hover:bg-canvas enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              Export Excel (table view)
            </button>
            <button
              type="button"
              disabled={rowCount === 0}
              onClick={() => exportCsv()}
              className="inline-flex min-h-[2.75rem] w-full items-center justify-center rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-medium text-ink shadow-sm ring-1 ring-ink/[0.04] hover:border-primary/40 hover:bg-canvas enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              Export CSV (table view)
            </button>
          </div>
        </div>
      </div>

      {visibleColumnsModalOpen ? (
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-ink/45 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeVisibleColumnsModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="visible-columns-dialog-title"
            className="w-[min(92vw,26rem)] max-w-none rounded-xl border border-ink/15 bg-surface p-5 text-left text-sm text-ink shadow-lg ring-1 ring-ink/[0.04]"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="space-y-3">
              <h3 id="visible-columns-dialog-title" className="text-base font-semibold text-ink [html.light_&]:text-slate-900">
                Columns to export
              </h3>
              <div className="space-y-2 text-xs leading-relaxed text-ink/55 [html.light_&]:text-slate-600">
                <p>Select at least one column. These columns will appear in the Excel / CSV export.</p>
                <p>
                  勾選會顯示喺表同 Excel／CSV；至少保留一欄。由 Course 或 Installment 表頭開窗時，下面可為該欄排序。
                </p>
              </div>
            </header>

            <div className="mt-5 space-y-3" role="presentation">
              <span className="block text-xs font-semibold tracking-wide text-ink/60 [html.light_&]:text-slate-700">
                Show
              </span>
              {EXPORT_COLUMN_ROWS.map((rowIds, rowIdx) => (
                <div
                  key={rowIds.join("-")}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2.5"
                  role="group"
                  aria-label={
                    rowIdx === 0 ? "Columns to show — date, client, course, amount" : "Columns to show — coach, status, installment"
                  }
                >
                  {rowIds.map((id) => (
                    <label
                      key={id}
                      className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-ink/80 hover:bg-canvas"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-ink/20 bg-canvas text-primary focus:ring-primary/40"
                        checked={columnVisibility[id] !== false}
                        onChange={(e) => setSalesColumnVisible(id, e.target.checked)}
                      />
                      <span className="whitespace-nowrap font-medium">{COLUMN_LABELS[id]}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            {columnPickerSource ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-ink/[0.08] pt-4 [html.light_&]:border-slate-200">
                <span className="mr-1 shrink-0 self-center text-xs text-ink/50 [html.light_&]:text-slate-600">
                  Sort 「{COLUMN_LABELS[columnPickerSource]}」:
                </span>
                <button
                  type="button"
                  className="rounded-md border border-ink/15 bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-canvas"
                  onClick={() => sortPickerSourceColumn(false)}
                >
                  A → Z
                </button>
                <button
                  type="button"
                  className="rounded-md border border-ink/15 bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-canvas"
                  onClick={() => sortPickerSourceColumn(true)}
                >
                  Z → A
                </button>
              </div>
            ) : null}
            <div className="mt-6 flex justify-start border-t border-ink/[0.06] pt-4 [html.light_&]:border-slate-200">
              <button
                type="button"
                className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary"
                onClick={closeVisibleColumnsModal}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          <p className="font-medium">Could not load report</p>
          <p className="mt-1 text-rose-100/80">{error}</p>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-ink/55">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading sales…
          </div>
        ) : totallyEmpty ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-medium text-ink/80">No sales for this period</p>
            <p className="mt-2 text-sm text-ink/50">Try another month on the backend or adjust filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-ink/10 bg-canvas">
                      {hg.headers.map((header) => (
                        <th key={header.id} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/55">
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
                        className="px-4 py-12 text-center text-ink/55"
                      >
                        No rows match 「{globalFilter}」. Clear the search
                        {installmentEnrollmentOnlyActive
                          ? ", or use 「關閉此篩選」 below to show all loaded sales."
                          : " to see all loaded sales."}
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-ink/[0.08] last:border-0 hover:bg-canvas/80"
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 px-4 py-3 text-xs text-ink/50">
              <span>
                Showing {filteredEmpty ? 0 : rowCount} of {data.length} loaded row{data.length === 1 ? "" : "s"}
              </span>
              <span className="tabular-nums">
                Sort: <span className="text-ink/70">{sortQuery ?? "default"}</span>
                {columnsQuery ? (
                  <>
                    {" · "}
                    Columns: <span className="text-ink/70">{columnsQuery}</span>
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
