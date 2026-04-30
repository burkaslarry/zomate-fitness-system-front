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
            <h2 className="text-2xl font-semibold text-white">學生名單</h2>
            <p className="mt-1 text-sm text-slate-300">Rows are clickable and open the member detail page.</p>
          </div>
          <Link href="/register" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">+ 新會員</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/15 bg-[#111827] p-4">
            <p className="text-xs text-slate-400">總學生數</p>
            <p className="mt-2 text-3xl font-semibold">{students.length}</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-[#111827] p-4">
            <p className="text-xs text-slate-400">活躍學生</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-300">{students.filter((s) => s.is_active || s.lesson_balance > 0).length}</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-[#111827] p-4">
            <p className="text-xs text-slate-400">有相片</p>
            <p className="mt-2 text-3xl font-semibold">{students.filter((s) => s.photo_path).length}</p>
          </div>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋姓名 / HKID / 電話" className="w-full rounded-lg border border-white/15 bg-[#1e1e1e] px-3 py-2 text-white" />
        {status && <p className="text-sm text-amber-200">{status}</p>}
        <div className="overflow-x-auto rounded-xl border border-white/15 bg-[#0b1220]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 text-slate-300">
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
                <tr key={student.id} className="border-b border-white/5 text-slate-200 hover:bg-white/[0.04]">
                  <td className="px-3 py-2">
                    {student.hkid ? (
                      <Link href={`/admin/students/${encodeURIComponent(student.hkid)}`} className="font-medium text-white underline underline-offset-4">
                        {student.full_name}
                      </Link>
                    ) : (
                      <span className="font-medium text-white">{student.full_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{student.hkid ?? "未填"}</td>
                  <td className="px-3 py-2">{student.phone}</td>
                  <td className="px-3 py-2">{student.lesson_balance}</td>
                  <td className="px-3 py-2">{student.is_active ? <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">活躍</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </BackendShell>
  );
}
