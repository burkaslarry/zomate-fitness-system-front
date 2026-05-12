"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { api } from "../../../lib/api";
import type { MemberProfile } from "../../../types/api";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<MemberProfile[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    api
      .listStudents()
      .then((data) => {
        const rows = Array.isArray(data) ? (data as MemberProfile[]) : [];
        setStudents(rows);
      })
      .catch((err) => setStatus(String(err)));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => `${s.full_name} ${s.hkid ?? ""} ${s.phone}`.toLowerCase().includes(q));
  }, [search, students]);

  return (
    <BackendShell title="學生管理">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-ink">學生名單</h2>
            <p className="mt-1 text-sm text-ink/70">點姓名可開啟會員詳情（需已填 HKID）。</p>
          </div>
          <Link
            href="/register"
            className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-primary"
          >
            + 新會員
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
            <p className="text-xs text-ink/55">總學生數</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{students.length}</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
            <p className="text-xs text-ink/55">活躍學生</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-700">{students.filter((s) => s.is_active || s.lesson_balance > 0).length}</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
            <p className="text-xs text-ink/55">有相片</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{students.filter((s) => s.photo_path).length}</p>
          </div>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋姓名 / HKID / 電話" />
        {status && <p className="text-sm text-amber-800">{status}</p>}
        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink/10 text-ink/65">
              <tr>
                <th className="px-3 py-2">姓名</th>
                <th className="px-3 py-2">HKID</th>
                <th className="px-3 py-2">電話</th>
                <th className="px-3 py-2">餘額</th>
                <th className="px-3 py-2">狀態</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id} className="border-b border-ink/[0.06] text-ink/85 hover:bg-canvas/80">
                  <td className="px-3 py-2">
                    {student.hkid ? (
                      <Link href={`/admin/students/${encodeURIComponent(student.hkid)}`} className="font-medium text-ink underline underline-offset-4">
                        {student.full_name}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{student.full_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{student.hkid ?? "未填"}</td>
                  <td className="px-3 py-2">{student.phone}</td>
                  <td className="px-3 py-2">{student.lesson_balance}</td>
                  <td className="px-3 py-2">{student.is_active ? <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-800">活躍</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </BackendShell>
  );
}
