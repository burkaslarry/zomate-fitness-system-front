"use client";

/**
 * [F008][S005]
 * Feature: Coach Session Management
 * Step: Attendance ledger data table — branch filter, sort, URL state
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react";
import { alertApiError, api } from "../lib/api";
import {
  type CoachAttendanceLedgerPayload,
  type CoachAttendanceLedgerRow,
  ledgerStatusClass,
  ledgerStatusLabel
} from "../lib/coach-attendance-ledger";
import { exportRowsToExcelSheet } from "../lib/excel-export";

type BranchOpt = { id: number; name: string };
type CoachOpt = { id: number; full_name: string };

type Props = {
  fixedCoachId?: number;
  showCoachFilter?: boolean;
  backHref?: string;
  backLabel?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function sortIdToApi(id: string): string {
  if (id === "branch_name") return "branch";
  if (id === "coach_name") return "coach";
  if (id === "session_date") return "date";
  if (id === "check_in_time") return "check_in";
  return id;
}

function CoachAttendanceLedgerInner({
  fixedCoachId,
  showCoachFilter = true,
  backHref,
  backLabel
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [coaches, setCoaches] = useState<CoachOpt[]>([]);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [coachId, setCoachId] = useState<number | "">(fixedCoachId ?? "");
  const [month, setMonth] = useState(searchParams.get("month") || currentMonthValue());
  const [branchFilter, setBranchFilter] = useState<string[]>(() => {
    const raw = searchParams.get("branch");
    if (!raw || raw === "All") return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  });
  const [rows, setRows] = useState<CoachAttendanceLedgerRow[]>([]);
  const [rangeLabel, setRangeLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const sorting = useMemo<SortingState>(() => {
    const sort = searchParams.get("sort") || "session_date";
    const order = searchParams.get("order") || "asc";
    return [{ id: sort, desc: order === "desc" }];
  }, [searchParams]);

  const syncUrl = useCallback(
    (next: {
      month?: string;
      branch?: string[];
      sort?: string;
      order?: string;
    }) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (next.month !== undefined) sp.set("month", next.month);
      if (next.branch !== undefined) {
        if (next.branch.length === 0) sp.delete("branch");
        else sp.set("branch", next.branch.join(","));
      }
      if (next.sort !== undefined) sp.set("sort", next.sort);
      if (next.order !== undefined) sp.set("order", next.order);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    if (fixedCoachId != null) {
      setCoachId(fixedCoachId);
      return;
    }
    void api
      .coaches()
      .then((list) => {
        const arr = list as CoachOpt[];
        setCoaches(arr);
        if (arr.length && coachId === "") setCoachId(arr[0].id);
      })
      .catch((e) => setStatus(String(e)));
  }, [fixedCoachId, coachId]);

  useEffect(() => {
    void api
      .branches()
      .then((list) => setBranches(list as BranchOpt[]))
      .catch(() => setBranches([]));
  }, []);

  const loadLedger = useCallback(async () => {
    if (coachId === "") {
      setRows([]);
      return;
    }
    setLoading(true);
    setStatus("");
    const sortCol = sorting[0]?.id ?? "session_date";
    const sortOrder = sorting[0]?.desc ? "desc" : "asc";
    try {
      const data = (await api.coachAttendanceLedger(Number(coachId), {
        month,
        branch: branchFilter.length ? branchFilter.join(",") : undefined,
        sortBy: sortIdToApi(sortCol),
        order: sortOrder
      })) as CoachAttendanceLedgerPayload;
      setRows(data.rows ?? []);
      setRangeLabel(`${data.from_date} – ${data.to_date}`);
      console.log("[F008][S005] Success: Loaded attendance ledger", {
        month: data.month,
        count: data.rows?.length ?? 0
      });
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
      setRows([]);
      console.error("[F008][S005] Error: Failed to load attendance ledger.");
    } finally {
      setLoading(false);
    }
  }, [coachId, month, branchFilter, sorting]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  function toggleBranch(name: string) {
    setBranchFilter((prev) => {
      const next = prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name];
      syncUrl({ branch: next });
      return next;
    });
  }

  function handleSort(columnId: string) {
    const current = sorting[0];
    const desc = current?.id === columnId ? !current.desc : false;
    syncUrl({ sort: columnId, order: desc ? "desc" : "asc" });
  }

  const columns = useMemo<ColumnDef<CoachAttendanceLedgerRow>[]>(
    () => [
      {
        id: "branch_name",
        accessorKey: "branch_name",
        header: "分店",
        cell: ({ row }) => (
          <span className="font-medium text-ink">{row.original.branch_name || "—"}</span>
        )
      },
      {
        id: "coach_name",
        accessorKey: "coach_name",
        header: "教練",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-ink">{row.original.coach_name}</p>
            {row.original.coach_username ? (
              <span className="mt-0.5 inline-flex rounded bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-ink/60">
                @{row.original.coach_username}
              </span>
            ) : null}
          </div>
        )
      },
      {
        id: "session_date",
        accessorKey: "session_date",
        header: "日期"
      },
      {
        id: "check_in_time",
        accessorKey: "check_in_time",
        header: "簽到時間"
      },
      {
        id: "check_out_time",
        accessorKey: "check_out_time",
        header: "簽退時間"
      },
      {
        id: "lessons_hours",
        accessorKey: "lessons_hours",
        header: "課堂/時數"
      },
      {
        id: "status",
        accessorKey: "status",
        header: "狀態",
        cell: ({ row }) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ledgerStatusClass(row.original.status)}`}
          >
            {ledgerStatusLabel(row.original.status)}
          </span>
        )
      },
      {
        id: "remarks",
        accessorKey: "remarks",
        header: "備註",
        cell: ({ row }) => row.original.remarks || "—"
      }
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    manualSorting: true,
    getCoreRowModel: getCoreRowModel()
  });

  async function exportExcel() {
    await exportRowsToExcelSheet({
      filename: `coach-attendance-ledger-${month}`,
      sheetName: `出勤 ${month}`,
      columns: [
        { header: "分店", key: "branch_name" },
        { header: "教練", key: "coach_name" },
        { header: "帳號", key: "coach_username" },
        { header: "日期", key: "session_date" },
        { header: "簽到時間", key: "check_in_time" },
        { header: "簽退時間", key: "check_out_time" },
        { header: "課堂/時數", key: "lessons_hours" },
        { header: "狀態", key: "status" },
        { header: "備註", key: "remarks" }
      ],
      rows: rows.map((r) => ({
        ...r,
        coach_username: r.coach_username ?? "",
        status: ledgerStatusLabel(r.status)
      }))
    });
  }

  function SortIcon({ columnId }: { columnId: string }) {
    const active = sorting[0]?.id === columnId;
    if (!active) return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />;
    return sorting[0]?.desc ? (
      <ArrowDown className="ml-1 inline h-3.5 w-3.5" />
    ) : (
      <ArrowUp className="ml-1 inline h-3.5 w-3.5" />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-ink sm:text-xl">教練出勤</h1>
          <p className="mt-1 text-sm text-ink/55">
            分店獨立欄位；可按分店篩選同排序。簽退時間未記錄時顯示 --:--。
            {rangeLabel ? (
              <span className="mt-0.5 block text-ink/80 sm:ml-1 sm:inline">範圍：{rangeLabel}</span>
            ) : null}
          </p>
          {backHref ? (
            <p className="mt-1 text-xs text-ink/45">
              <a href={backHref} className="font-medium text-primary underline-offset-2 hover:underline">
                ← {backLabel ?? "返回"}
              </a>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void exportExcel()}
          disabled={rows.length === 0 || loading}
          className="w-full shrink-0 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-black disabled:opacity-40 sm:w-auto"
        >
          匯出 Excel
        </button>
      </div>

      <section className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
          {showCoachFilter ? (
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
          ) : null}
          <label className="block w-full text-sm text-ink sm:w-auto">
            月份（yyyy-MM）
            <input
              type="month"
              value={month}
              onChange={(e) => {
                const v = e.target.value || currentMonthValue();
                setMonth(v);
                syncUrl({ month: v });
              }}
              className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-2 py-2 text-ink"
            />
          </label>
        </div>

        {branches.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">
              分店篩選 Filter by Branch
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setBranchFilter([]);
                  syncUrl({ branch: [] });
                }}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  branchFilter.length === 0
                    ? "border-primary bg-primary/15 font-medium text-black"
                    : "border-ink/15 bg-canvas text-ink/70"
                }`}
              >
                全部 All
              </button>
              {branches.map((b) => {
                const active = branchFilter.includes(b.name);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBranch(b.name)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      active
                        ? "border-primary bg-primary/15 font-medium text-black"
                        : "border-ink/15 bg-canvas text-ink/70 hover:border-primary/30"
                    }`}
                  >
                    {b.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {status ? <p className="text-sm text-rose-600">{status}</p> : null}

      <section className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink/50">
            <Loader2 className="h-5 w-5 animate-spin" />
            載入出勤紀錄…
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink/10 bg-canvas/80 text-xs text-ink/55">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => {
                    const id = header.column.id;
                    const sortable = [
                      "branch_name",
                      "coach_name",
                      "session_date",
                      "check_in_time",
                      "status"
                    ].includes(id);
                    return (
                      <th key={header.id} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                        {sortable ? (
                          <button
                            type="button"
                            className="inline-flex items-center hover:text-ink"
                            onClick={() => handleSort(id)}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <SortIcon columnId={id} />
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-8 text-center text-ink/50">
                    此月份沒有符合條件的出勤紀錄。
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-t border-ink/[0.06] align-top">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 text-ink/85">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default function CoachAttendanceLedgerTable(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-sm text-ink/50">載入中…</div>
      }
    >
      <CoachAttendanceLedgerInner {...props} />
    </Suspense>
  );
}
