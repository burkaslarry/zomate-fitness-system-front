"use client";

/*
 * Admin — onboarding CSV hub. Data：FastAPI（zomate-fitness-system-back）→ PostgreSQL `zomate_fs_*`
 *（DATABASE_URL，例如 Render eventxp）。本地 dev 預設 API：`http://127.0.0.1:8000`。
 * 僅在設定 NEXT_PUBLIC_USE_NEXT_MOCK_API=1 時才用 Next mock routes。
 */

import { useCallback, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { api, downloadCsv, getResolvedApiBaseUrl, isUsingNextMockApi, uploadCsv } from "../../../lib/api";

type GridRow = {
  id?: number;
  full_name: string;
  phone: string;
  email?: string | null;
  health_notes?: string | null;
  disclaimer_accepted?: boolean | null;
  pin_code?: string;
  lesson_balance: number;
  face_id_external?: string | null;
};

type ColumnKey = keyof GridRow | "disclaimer_accepted_csv";

const GRID_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "full_name", label: "full_name" },
  { key: "phone", label: "phone" },
  { key: "email", label: "email" },
  { key: "health_notes", label: "health_notes" },
  { key: "disclaimer_accepted_csv", label: "disclaimer_accepted" },
  { key: "pin_code", label: "pin_code" },
  { key: "lesson_balance", label: "lesson_balance" },
  { key: "face_id_external", label: "face_id_external" }
];

function cellValue(row: GridRow, key: ColumnKey): string {
  if (key === "disclaimer_accepted_csv") {
    const v = row.disclaimer_accepted;
    if (v === true) return "1";
    if (v === false) return "0";
    return "";
  }
  if (key === "phone") {
    const p = (row.phone ?? "").replace(/\s+/g, "");
    return p.startsWith("+") ? p.slice(1) : p;
  }
  const raw = row[key];
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

/** Map FastAPI or mock rows into grid shape; sort by id ascending like CSV export order. */
function normalizeGridRows(raw: unknown): GridRow[] {
  if (!Array.isArray(raw)) return [];
  const mapped = raw.map((r) => {
    const o = r as Record<string, unknown>;
    return {
      id: typeof o.id === "number" ? o.id : undefined,
      full_name: String(o.full_name ?? ""),
      phone: String(o.phone ?? ""),
      email: (o.email as string | null | undefined) ?? "",
      health_notes: (o.health_notes as string | null | undefined) ?? "",
      disclaimer_accepted:
        o.disclaimer_accepted === true ? true : o.disclaimer_accepted === false ? false : null,
      pin_code: String(o.pin_code ?? ""),
      lesson_balance: Number(o.lesson_balance ?? 0),
      face_id_external: (o.face_id_external as string | null | undefined) ?? ""
    } as GridRow;
  });
  return mapped.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

async function fetchStudentsFallbackNextMock(): Promise<GridRow[]> {
  const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/students`, {
    cache: "no-store"
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return normalizeGridRows(json);
}

export default function AdminOnboardingRecordsPage() {
  const [status, setStatus] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshGrid = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setStatus("");
    try {
      const data = await api.listStudents();
      setRows(normalizeGridRows(data));
    } catch (e) {
      try {
        const fallback = await fetchStudentsFallbackNextMock();
        setRows(fallback);
        setLoadError(null);
        setStatus(
          "後端 FastAPI 無法連線，已改顯示本機 Next mock 資料（與 students.csv 欄位一致）。"
        );
      } catch {
        setRows([]);
        const msg = String(e);
        setLoadError(
          msg.includes("Failed to fetch") || msg.includes("NetworkError")
            ? `無法連線至 FastAPI（${getResolvedApiBaseUrl() || "—"}），且無法載入 Next mock。請啟動後端或設定 NEXT_PUBLIC_USE_NEXT_MOCK_API=1 / 檢查網路。`
            : msg
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshGrid();
  }, [refreshGrid]);

  return (
    <BackendShell title="入職紀錄 / 健康表單">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">入職紀錄 (Onboarding Records)</h2>
        <div className="space-y-2 rounded-lg border border-[#374151] bg-[#0f172a]/80 px-4 py-3 text-sm text-slate-300">
          <p>
            資料來源：<span className="font-medium text-white">FastAPI</span> → PostgreSQL（表前缀{" "}
            <code className="rounded bg-[#262626] px-1.5 py-0.5 font-mono text-xs text-emerald-200/95">zomate_fs_*</code>
            ，由後端 <code className="rounded bg-[#262626] px-1 font-mono text-xs">DATABASE_URL</code> 連 eventxp）。
          </p>
          <p className="text-xs text-slate-400">
            前端 API：<code className="rounded bg-[#262626] px-1 font-mono">{getResolvedApiBaseUrl() || "(mock)"}</code>
            {isUsingNextMockApi() ? (
              <> · 目前為 Next mock；正式環境請勿設定 NEXT_PUBLIC_USE_NEXT_MOCK_API。</>
            ) : (
              <> · CSV 匯入／匯出與下方表格皆經同一 Bearer 打後端。</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-[#FFFFFF] px-3 py-2 text-sm font-medium text-black hover:bg-neutral-100"
            onClick={async () => {
              try {
                await downloadCsv("/api/admin/students/export.csv", "students.csv");
                setStatus("已從後端匯出 students.csv");
              } catch (e) {
                setStatus(String(e));
              }
            }}
          >
            匯出 students.csv（後端）
          </button>
          <label className="cursor-pointer rounded-md border border-[#333] px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.04]">
            匯入 CSV（後端）
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                try {
                  const r = await uploadCsv("/api/admin/students/import", file);
                  setStatus(`匯入完成：${r.imported ?? 0} 筆（略過 ${r.skipped ?? 0}）`);
                  await refreshGrid();
                } catch (err) {
                  setStatus(String(err));
                }
                ev.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="rounded-md border border-[#334155] px-3 py-2 text-sm text-slate-200 hover:border-[#6366f1]/50 hover:bg-white/[0.04]"
            onClick={() => void refreshGrid()}
            disabled={loading}
          >
            {loading ? "重新載入中…" : "重新載入列表"}
          </button>
        </div>
        {loadError && <p className="text-sm text-rose-400">{loadError}</p>}
        {status && !loadError && <p className="text-sm text-emerald-300">{status}</p>}

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              CSV 對應欄位（full_name · phone · … — 與匯出 students.csv 相同順序）
            </p>
            {!loading && rows.length > 0 && (
              <span className="text-[11px] text-slate-500">{rows.length} 筆</span>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-[#374151] bg-[#0b1220] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#374151] text-slate-300">
                <tr>
                  {GRID_COLUMNS.map((col) => (
                    <th key={col.label} className="whitespace-nowrap px-3 py-2.5 font-medium">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={GRID_COLUMNS.length} className="px-3 py-10 text-center text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-[#6366f1]" />
                        從資料庫載入…
                      </span>
                    </td>
                  </tr>
                ) : rows.length > 0 ? (
                  rows.map((row, i) => (
                    <tr
                      key={row.id != null ? String(row.id) : `${row.phone}-${i}`}
                      className="border-b border-[#1f2937] text-slate-200 transition hover:bg-white/[0.02]"
                    >
                      {GRID_COLUMNS.map((col) => (
                        <td key={col.label} className="max-w-[220px] truncate px-3 py-2 font-mono text-xs">
                          {cellValue(row, col.key)}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : loadError ? null : (
                  <tr>
                    <td colSpan={GRID_COLUMNS.length} className="px-3 py-10 text-center text-slate-400">
                      無資料。請確認後端已連線資料庫並已登入後台。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </BackendShell>
  );
}
