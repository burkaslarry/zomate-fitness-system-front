"use client";

/**
 * [F001][S002]
 * Feature: Student Onboarding
 * Step: Admin student roster — detail links, full CSV export, 5-row template, batch import
 * Logic: Template mirrors FastAPI export / import columns; no 入職紀錄 hub (removed).
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { alertApiError, api, downloadCsv, uploadCsv } from "../../../lib/api";
import type { MemberProfile } from "../../../types/api";

const STUDENT_CSV_HEADERS = [
  "full_name",
  "phone",
  "hkid",
  "email",
  "health_notes",
  "disclaimer_accepted",
  "lesson_balance",
  "face_id_external",
  "created_at"
] as const;

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
        csvEscape(s.email ?? ""),
        csvEscape(""),
        csvEscape(1),
        csvEscape(s.lesson_balance),
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

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<MemberProfile[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(() => {
    api
      .listStudents()
      .then((data) => {
        const rows = Array.isArray(data) ? (data as MemberProfile[]) : [];
        setStudents(rows);
      })
      .catch((err) => setStatus(String(err)));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => `${s.full_name} ${s.hkid ?? ""} ${s.phone}`.toLowerCase().includes(q));
  }, [search, students]);

  async function onExport() {
    try {
      await downloadCsv("/api/admin/students/export.csv", "students.csv");
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

  async function onImportFile(f: File | null) {
    if (!f) return;
    setStatus("匯入中…");
    try {
      const res = (await uploadCsv("/api/admin/students/import", f)) as {
        imported?: number;
        updated?: number;
        skipped?: number;
      };
      setStatus(`匯入完成：新增 ${res.imported ?? 0}，更新 ${res.updated ?? 0}，略過 ${res.skipped ?? 0}`);
      reload();
    } catch (e) {
      setStatus("");
      alertApiError(e);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <BackendShell title="學生管理">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold text-ink">學生名單</h2>
            <p className="mt-1 text-sm text-ink/70">
              點姓名可用學生 ID 開啟會員詳情（毋須 HKID）。<strong className="font-medium text-ink">匯出 CSV 範本（首 5 筆）</strong>
              方便對照批次匯入欄位；完整名單請用「匯出 CSV」。
            </p>
            <div className="mt-3 rounded-lg border border-ink/12 bg-canvas/80 p-3 text-xs leading-relaxed text-ink/75">
              <p className="font-semibold text-ink">CSV 批次匯入</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                <li>欄位須與範本／後台匯出一致：{STUDENT_CSV_HEADERS.join("、")}。</li>
                <li>
                  僅當<strong className="text-ink">姓名與電話皆與現有學員吻合</strong>時才更新該筆；電話相同但姓名不同會略過。
                </li>
                <li>新增列須有姓名 + 有效香港電話；可調整 lesson_balance（以 ledger 差額寫入）。</li>
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onExport()}
              className="rounded-lg border border-ink/15 bg-canvas px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-canvas/80"
            >
              匯出 CSV
            </button>
            <button
              type="button"
              onClick={() => onExportTemplateSample()}
              className="rounded-lg border border-ink/15 bg-canvas px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-canvas/80"
            >
              匯出 CSV 範本（首 5 筆）
            </button>
            <label className="cursor-pointer rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-primary">
              匯入 CSV
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Link
              href="/register"
              className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-primary"
            >
              + 新會員
            </Link>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
            <p className="text-xs text-ink/55">總學生數</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{students.length}</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
            <p className="text-xs text-ink/55">活躍學生</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-700">
              {students.filter((s) => s.is_active || s.lesson_balance > 0).length}
            </p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
            <p className="text-xs text-ink/55">有相片</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{students.filter((s) => s.photo_path).length}</p>
          </div>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋姓名 / HKID / 電話"
          className="w-full max-w-md rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink shadow-sm"
        />
        {status && <p className="text-sm text-amber-800">{status}</p>}
        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink/10 text-ink/65">
              <tr>
                <th className="px-3 py-2">姓名</th>
                <th className="px-3 py-2">HKID</th>
                <th className="px-3 py-2">電話</th>
                <th className="px-3 py-2">註冊時間</th>
                <th className="px-3 py-2">餘額</th>
                <th className="px-3 py-2">狀態</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
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
                  <td className="px-3 py-2">{student.phone}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatCreatedAt(student.created_at)}</td>
                  <td className="px-3 py-2">{student.lesson_balance}</td>
                  <td className="px-3 py-2">
                    {student.is_active ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-800">活躍</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </BackendShell>
  );
}
