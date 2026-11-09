"use client";

/**
 * [F001][S003]
 * Feature: Student Onboarding
 * Step: Admin student roster — paginated list (100/page), loading screen, CSV import/export
 * Logic: Server-side page/search; enrich only current page to keep 1k+ rosters usable.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { alertApiError, api, downloadCsv, uploadCsv } from "../../../lib/api";
import type { MemberProfile } from "../../../types/api";

const PAGE_SIZE = 100;

const STUDENT_CSV_HEADERS = [
  "full_name",
  "phone",
  "hkid",
  "gender",
  "date_of_birth",
  "email",
  "health_notes",
  "disclaimer_accepted",
  "lesson_balance",
  "emergency_contact_name",
  "emergency_contact_relationship",
  "emergency_contact_phone",
  "face_id_external",
  "created_at"
] as const;

const FUNG_STUDENT_CSV_HEADERS = [
  "MemberCode",
  "PT",
  "Name",
  "Gender",
  "phone number",
  "Date of Birth",
  "ID Number",
  "Emergency Contact",
  "Emergency Contact Number"
] as const;

type StudentsListResponse = {
  items?: MemberProfile[];
  total?: number;
  limit?: number;
  offset?: number;
  total_all?: number;
  active_count?: number;
  medical_pending_count?: number;
};

function formatCreatedAt(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString("zh-HK", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/** [F001][S003] Compact date display for DOB and last check-in in the enriched member list. */
function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "未填";
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("zh-HK");
  } catch {
    return iso;
  }
}

function csvEscape(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Sample file for batch import: same columns as `GET /api/admin/students/export.csv`, max 5 data rows. */
function downloadImportTemplateSample(students: MemberProfile[]) {
  const sample = students.slice(0, 5);
  const lines: string[] = [STUDENT_CSV_HEADERS.join(",")];
  for (const s of sample) {
    lines.push(
      [
        csvEscape(s.full_name),
        csvEscape(s.phone),
        csvEscape(s.hkid ?? ""),
        csvEscape(s.gender ?? ""),
        csvEscape(s.date_of_birth ?? ""),
        csvEscape(s.email ?? ""),
        csvEscape(""),
        csvEscape(1),
        csvEscape(s.lesson_balance),
        csvEscape(s.emergency_contact_name ?? ""),
        csvEscape(s.emergency_contact_relationship ?? ""),
        csvEscape(s.emergency_contact_phone ?? ""),
        csvEscape(""),
        csvEscape(s.created_at)
      ].join(",")
    );
  }
  const body = `\ufeff${lines.join("\n")}`;
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `students-import-template-${sample.length}-rows.csv`;
  a.click();
  URL.revokeObjectURL(href);
}

function downloadFungTemplateSample(students: MemberProfile[]) {
  const sample = students.slice(0, 5);
  const lines: string[] = [FUNG_STUDENT_CSV_HEADERS.join(",")];
  for (const s of sample) {
    const genderZh = s.gender === "male" ? "男" : s.gender === "female" ? "女" : s.gender ?? "";
    const emerg =
      s.emergency_contact_name && s.emergency_contact_relationship
        ? `${s.emergency_contact_name} (${s.emergency_contact_relationship})`
        : s.emergency_contact_name ?? "";
    lines.push(
      [
        csvEscape(s.phone),
        csvEscape(""),
        csvEscape(s.full_name),
        csvEscape(genderZh),
        csvEscape(s.phone),
        csvEscape(s.date_of_birth ?? ""),
        csvEscape(s.hkid ?? ""),
        csvEscape(emerg),
        csvEscape(s.emergency_contact_phone ?? "")
      ].join(",")
    );
  }
  const body = `\ufeff${lines.join("\n")}`;
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `students-fung-template-${sample.length}-rows.csv`;
  a.click();
  URL.revokeObjectURL(href);
}

function medicalStatusBadge(status: MemberProfile["medical_clearance_status"]) {
  if (status === "pending") {
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-900">
        候補
      </span>
    );
  }
  if (status === "received") {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-900">
        已收證明
      </span>
    );
  }
  return null;
}

export default function AdminStudentsPage() {
  const [medicalPendingOnly, setMedicalPendingOnly] = useState(false);
  const [students, setStudents] = useState<MemberProfile[]>([]);
  const [coaches, setCoaches] = useState<{ id: number; full_name: string }[]>([]);
  const [coachId, setCoachId] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [medicalPendingCount, setMedicalPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, medicalPendingOnly]);

  const reload = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const data = (await api.listStudents({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        q: debouncedSearch || undefined,
        medical_pending: medicalPendingOnly || undefined
      })) as StudentsListResponse;
      if (seq !== requestSeq.current) return;
      const rows = Array.isArray(data.items) ? data.items : [];
      setStudents(rows);
      setTotal(Number(data.total ?? rows.length));
      setTotalAll(Number(data.total_all ?? data.total ?? rows.length));
      setActiveCount(Number(data.active_count ?? 0));
      setMedicalPendingCount(Number(data.medical_pending_count ?? 0));
      setStatus("");
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setStatus(String(err));
      setStudents([]);
      setTotal(0);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [page, debouncedSearch, medicalPendingOnly]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMedicalPendingOnly(new URLSearchParams(window.location.search).get("medical_pending") === "1");
  }, []);

  useEffect(() => {
    api
      .coaches()
      .then((rows) => {
        const list = Array.isArray(rows) ? (rows as { id: number; full_name: string }[]) : [];
        setCoaches(list);
      })
      .catch(() => setCoaches([]));
  }, []);

  const selectedCoach = coaches.find((c) => c.id === coachId) ?? null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(page * PAGE_SIZE, total);

  async function onExport() {
    try {
      await downloadCsv("/api/admin/students/export.csv", "students.csv");
    } catch (e) {
      alertApiError(e);
    }
  }

  async function onExportExcel() {
    try {
      await downloadCsv("/api/admin/students/export.xlsx", "students.xlsx");
      setStatus("已匯出學生名單 Excel。");
    } catch (e) {
      alertApiError(e);
    }
  }

  async function onExportCoach(format: "xlsx" | "csv") {
    if (!selectedCoach) return;
    try {
      const safeName = selectedCoach.full_name.replace(/[\\/:*?"<>|\s]+/g, "-");
      await downloadCsv(
        `/api/admin/students/export.${format}?coach_id=${selectedCoach.id}`,
        `students-${safeName}.${format}`
      );
      setStatus(`已匯出教練 ${selectedCoach.full_name} 學生名單（${format.toUpperCase()}）。`);
    } catch (e) {
      alertApiError(e);
    }
  }

  async function onExportFung() {
    try {
      await downloadCsv("/api/admin/students/export.fung.csv", "students-fung.csv");
      setStatus("已匯出 Fung Excel 格式學生 CSV（可直接再匯入）。");
    } catch (e) {
      alertApiError(e);
    }
  }

  function onExportTemplateSample() {
    downloadImportTemplateSample(students);
    if (!students.length) {
      setStatus("範本只有表頭（暫無學員）；匯入欄位請對照說明或稍後有資料再匯出範本。");
    } else {
      setStatus(`已下載範本（最多 5 筆，本次 ${Math.min(5, students.length)} 筆）。`);
    }
  }

  function onExportFungTemplateSample() {
    downloadFungTemplateSample(students);
    setStatus(
      students.length
        ? `已下載 Fung 格式範本（最多 5 筆，本次 ${Math.min(5, students.length)} 筆）。`
        : "Fung 範本只有表頭（暫無學員）。"
    );
  }

  async function onImportFile(f: File | null) {
    if (!f) return;
    setStatus("匯入中…");
    try {
      const res = (await uploadCsv("/api/admin/students/import", f)) as {
        imported?: number;
        updated?: number;
        restored?: number;
        skipped?: number;
        before_count?: number;
        after_count?: number;
        skip_reasons?: Array<{
          row?: number;
          code?: string;
          field?: string | null;
          reason?: string;
          message?: string;
          name?: string | null;
          phone?: string | null;
        }>;
      };
      const reasonLines =
        Array.isArray(res.skip_reasons) && res.skip_reasons.length
          ? "｜略過詳情：" +
            res.skip_reasons
              .slice(0, 8)
              .map((r) => r.message ?? `第${r.row ?? "?"}行 ${r.reason ?? ""}`)
              .join("；")
          : "";
      const countLine =
        res.before_count != null && res.after_count != null
          ? `｜名單 ${res.before_count} → ${res.after_count}`
          : "";
      const restoredLine = res.restored ? `，還原 ${res.restored}` : "";
      setStatus(
        `匯入完成：新增 ${res.imported ?? 0}，更新 ${res.updated ?? 0}${restoredLine}，略過 ${res.skipped ?? 0}${countLine}${reasonLines}`
      );
      setPage(1);
      await reload();
    } catch (e) {
      setStatus("");
      alertApiError(e);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <BackendShell title="學生管理">
      <div className="relative mx-auto max-w-6xl space-y-5">
        {loading ? (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/35 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-8 py-7 shadow-xl">
              <span
                className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/25 border-t-primary"
                aria-hidden
              />
              <p className="text-sm font-medium text-ink">載入學生名單…</p>
              <p className="text-xs text-ink/55">每次顯示 {PAGE_SIZE} 筆</p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold text-ink sm:text-2xl">學生名單</h2>
            {medicalPendingOnly ? (
              <p className="mt-1 text-sm text-ink/70">
                <strong className="font-medium text-amber-900">目前只顯示 PAR-Q 候補（待醫生證明）學員。</strong>{" "}
                <Link href="/admin/students" className="text-primary underline">
                  顯示全部
                </Link>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onExportExcel()}
              className="rounded-lg border border-ink/15 bg-canvas px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-canvas/80"
            >
              匯出 Excel
            </button>
            <button
              type="button"
              onClick={() => void onExport()}
              className="rounded-lg border border-ink/15 bg-canvas px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-canvas/80"
            >
              匯出 CSV
            </button>
            <button
              type="button"
              onClick={() => void onExportFung()}
              className="rounded-lg border border-ink/15 bg-canvas px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-canvas/80"
            >
              匯出 Fung CSV
            </button>
            <button
              type="button"
              onClick={() => onExportTemplateSample()}
              className="rounded-lg border border-ink/15 bg-canvas px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-canvas/80"
            >
              匯出 CSV 範本（首 5 筆）
            </button>
            <button
              type="button"
              onClick={() => onExportFungTemplateSample()}
              className="rounded-lg border border-ink/15 bg-canvas px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-canvas/80"
            >
              Fung 範本（首 5 筆）
            </button>
            <label className="cursor-pointer rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-primary">
              匯入 CSV／Excel
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Link
              href="/register"
              className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-primary"
            >
              + 新會員
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
          <label className="block text-xs text-ink/55">
            教練
            <select
              className="mt-1 block min-w-56 rounded-lg border border-ink/15 bg-surface px-2 py-2 text-sm text-ink"
              value={coachId === "" ? "" : String(coachId)}
              onChange={(e) => setCoachId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">全部教練</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </label>
          {selectedCoach ? (
            <>
              <button
                type="button"
                onClick={() => void onExportCoach("xlsx")}
                className="rounded-lg bg-primary/90 px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-primary"
              >
                匯出教練 {selectedCoach.full_name} Excel
              </button>
              <button
                type="button"
                onClick={() => void onExportCoach("csv")}
                className="rounded-lg border border-ink/15 bg-canvas px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-canvas/80"
              >
                匯出教練 {selectedCoach.full_name} CSV
              </button>
            </>
          ) : (
            <p className="pb-1 text-xs text-ink/50">選擇教練後可匯出其學生名單（Excel／CSV）。</p>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
            <p className="text-xs text-ink/55">總學生數</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{totalAll}</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
            <p className="text-xs text-ink/55">活躍學生</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-700">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
            <p className="text-xs text-ink/55">PAR-Q 候補</p>
            <p className="mt-2 text-3xl font-semibold text-amber-800">{medicalPendingCount}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋姓名 / HKID / 電話"
            className="w-full max-w-md rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink shadow-sm"
          />
          <p className="text-xs text-ink/55">
            {total === 0 ? "沒有符合條件的學員" : `顯示第 ${rangeFrom}–${rangeTo} 筆／共 ${total} 筆符合條件`}
            {debouncedSearch ? `（搜尋「${debouncedSearch}」）` : ""}
          </p>
        </div>
        {status && <p className="text-sm text-amber-800">{status}</p>}
        {/* [F001][S003] Desktop roster — content-rich but horizontal-scroll only when needed. */}
        <div className="hidden overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink/10 text-ink/65">
              <tr>
                <th className="px-3 py-2">姓名</th>
                <th className="px-3 py-2">HKID</th>
                <th className="px-3 py-2">DOB</th>
                <th className="px-3 py-2">電話</th>
                <th className="px-3 py-2">剩餘堂數</th>
                <th className="px-3 py-2">套餐狀態</th>
                <th className="px-3 py-2">健康</th>
                <th className="px-3 py-2">註冊日</th>
                <th className="px-3 py-2">最後簽到</th>
              </tr>
            </thead>
            <tbody>
              {!loading && students.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-ink/55">
                    沒有學員資料
                  </td>
                </tr>
              ) : null}
              {students.map((student) => (
                <tr key={student.id} className="border-b border-ink/[0.06] text-ink/85 hover:bg-canvas/80">
                  <td className="px-3 py-2">
                    {student.id ? (
                      <Link
                        href={`/admin/students/${student.id}`}
                        className="font-medium text-ink underline underline-offset-4"
                      >
                        {student.full_name}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{student.full_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{student.hkid ?? "未填"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateOnly(student.date_of_birth)}</td>
                  <td className="px-3 py-2">{student.phone}</td>
                  <td className="px-3 py-2">{student.lesson_balance}</td>
                  <td className="px-3 py-2 min-w-44">
                    <span className="rounded-full bg-purple-500/15 px-2 py-1 text-xs font-medium text-purple-900">
                      {student.current_course_package_status ?? (student.is_active ? "Active" : "No active package")}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {medicalStatusBadge(student.medical_clearance_status) ?? "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateOnly(student.created_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateOnly(student.last_checkin_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* [F001][S003] Mobile roster — card grouping keeps DOB/status/check-in readable without table squeeze. */}
        <div className="space-y-3 md:hidden">
          {!loading && students.length === 0 ? (
            <p className="rounded-xl border border-ink/10 bg-surface p-6 text-center text-sm text-ink/55">
              沒有學員資料
            </p>
          ) : null}
          {students.map((student) => (
            <article key={student.id} className="rounded-xl border border-ink/10 bg-surface p-4 text-sm shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/admin/students/${student.id}`}
                    className="font-semibold text-ink underline underline-offset-4"
                  >
                    {student.full_name}
                  </Link>
                  <p className="mt-1 text-xs text-ink/60">
                    {student.phone} · HKID {student.hkid ?? "未填"}
                  </p>
                  {medicalStatusBadge(student.medical_clearance_status) ? (
                    <p className="mt-1">{medicalStatusBadge(student.medical_clearance_status)}</p>
                  ) : null}
                </div>
                <span className="rounded-full bg-purple-500/15 px-2 py-1 text-xs font-medium text-purple-900">
                  {student.lesson_balance} 堂
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink/70">
                <div>
                  <dt className="font-medium text-ink">DOB</dt>
                  <dd>{formatDateOnly(student.date_of_birth)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-ink">註冊日</dt>
                  <dd>{formatDateOnly(student.created_at)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-ink">套餐狀態</dt>
                  <dd>{student.current_course_package_status ?? "No active package"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-ink">最後簽到</dt>
                  <dd>{formatDateOnly(student.last_checkin_at)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
          <p className="text-xs text-ink/55">
            第 {page} / {totalPages} 頁
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage(1)}
              className="rounded-lg border border-ink/15 bg-canvas px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-40"
            >
              第一頁
            </button>
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-ink/15 bg-canvas px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-40"
            >
              上一頁
            </button>
            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-ink/15 bg-canvas px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-40"
            >
              下一頁
            </button>
            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="rounded-lg border border-ink/15 bg-canvas px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-40"
            >
              最後一頁
            </button>
          </div>
        </div>
      </div>
    </BackendShell>
  );
}
