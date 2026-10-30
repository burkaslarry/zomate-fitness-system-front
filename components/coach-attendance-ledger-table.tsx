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
  type CoachAttendanceLedgerPackage,
  type CoachAttendanceLedgerPayload,
  type CoachAttendanceLedgerRow,
  type CoachAttendanceLedgerSummary,
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
  const [summary, setSummary] = useState<CoachAttendanceLedgerSummary>({
    month_checkins: 0,
    cumulative_checkins: 0,
    month_lessons: 0
  });
  const [packages, setPackages] = useState<CoachAttendanceLedgerPackage[]>([]);
  const [rangeLabel, setRangeLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // [F008][S005] 年／月 dropdowns replace the native month input.
  const selectedYear = Number(month.slice(0, 4)) || new Date().getFullYear();
  const selectedMonthNum = Number(month.slice(5, 7)) || new Date().getMonth() + 1;
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const years = new Set<number>();
    for (let y = now - 3; y <= now + 1; y += 1) years.add(y);
    years.add(selectedYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [selectedYear]);

  function setMonthParts(year: number, monthNum: number) {
    const v = `${year}-${pad2(monthNum)}`;
    setMonth(v);
    syncUrl({ month: v });
  }

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
      setSummary(data.summary ?? { month_checkins: 0, cumulative_checkins: 0, month_lessons: 0 });
      setPackages(data.packages ?? []);
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
        id: "student_name",
        accessorKey: "student_name",
        header: "學員",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-ink">{row.original.student_name || "—"}</p>
            <p className="mt-0.5 text-xs tabular-nums text-ink/55">
              {row.original.student_phone || "—"}
            </p>
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
        { header: "學員", key: "student_name" },
        { header: "電話", key: "student_phone" },
        { header: "上咩課堂", key: "course_type" },
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
        student_name: r.student_name ?? "",
        student_phone: r.student_phone ?? "",
        course_type: r.course_type || "—",
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
            年
            <select
              value={selectedYear}
              onChange={(e) => setMonthParts(Number(e.target.value), selectedMonthNum)}
              className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-2 py-2 text-ink"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="block w-full text-sm text-ink sm:w-auto">
            月
            <select
              value={selectedMonthNum}
              onChange={(e) => setMonthParts(selectedYear, Number(e.target.value))}
              className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-2 py-2 text-ink"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m} 月
                </option>
              ))}
            </select>
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

      <dl className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
          <dt className="text-[11px] text-ink/55 sm:text-xs">本月簽到</dt>
          <dd className="mt-1 text-[22px] font-semibold tabular-nums leading-none text-ink sm:text-[28px]">
            {summary.month_checkins}
          </dd>
          <p className="mt-1 text-[11px] text-ink/45">共 {summary.month_lessons} 堂已排</p>
        </div>
        <div className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
          <dt className="text-[11px] text-ink/55 sm:text-xs">累計簽到</dt>
          <dd className="mt-1 text-[22px] font-semibold tabular-nums leading-none text-ink sm:text-[28px]">
            {summary.cumulative_checkins}
          </dd>
          <p className="mt-1 text-[11px] text-ink/45">所有 package 合計</p>
        </div>
        <div className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
          <dt className="text-[11px] text-ink/55 sm:text-xs">Package 數</dt>
          <dd className="mt-1 text-[22px] font-semibold tabular-nums leading-none text-ink sm:text-[28px]">
            {packages.length}
          </dd>
          <p className="mt-1 text-[11px] text-ink/45">每個 package 堂數見下</p>
        </div>
      </dl>

      {packages.length > 0 ? (
        <section className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 sm:px-4">
            <h2 className="text-sm font-semibold text-ink">每個 package 堂數</h2>
            <p className="text-[11px] text-ink/50">總堂／已上／剩餘，按學員排列</p>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="border-y border-ink/10 bg-canvas/80 text-xs text-ink/55">
              <tr>
                <th className="px-3 py-2 font-semibold">學員</th>
                <th className="px-3 py-2 font-semibold">Package</th>
                <th className="px-3 py-2 font-semibold">分店</th>
                <th className="px-3 py-2 text-right font-semibold">總堂</th>
                <th className="px-3 py-2 text-right font-semibold">已上</th>
                <th className="px-3 py-2 text-right font-semibold">剩餘</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.enrollment_id} className="border-t border-ink/[0.06]">
                  <td className="px-3 py-2 font-medium text-ink">{p.student_name || "—"}</td>
                  <td className="px-3 py-2 text-ink/85">{p.course_title}</td>
                  <td className="px-3 py-2 text-ink/70">{p.branch_name ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.total_lessons}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.used_lessons}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      p.remaining_lessons > 0 ? "font-semibold text-emerald-700" : "text-ink/45"
                    }`}
                  >
                    {p.remaining_lessons}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

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
