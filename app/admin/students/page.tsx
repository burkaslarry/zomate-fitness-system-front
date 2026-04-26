"use client";

import { useState } from "react";
import BackendShell from "../../../components/backend-shell";
import Link from "next/link";
import { csvUrl, uploadCsv } from "../../../lib/api";

export default function AdminStudentsPage() {
  const [status, setStatus] = useState("");

  return (
    <BackendShell title="學生管理">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">學生名單</h2>
        <p className="text-sm text-slate-400">Demo 導覽頁：可於主後台進行學生資料、餘額與 FaceID 綁定管理。</p>
        <div className="flex flex-wrap gap-2">
          <a href={csvUrl.studentsExport()} className="rounded-md border border-[#333] px-3 py-2 text-sm text-slate-200">
            匯出 students.csv
          </a>
          <label className="cursor-pointer rounded-md border border-[#333] px-3 py-2 text-sm text-slate-200">
            匯入 CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                try {
                  const r = await uploadCsv("/api/admin/students/import", file);
                  setStatus(`學生匯入：${r.imported ?? 0} 筆，略過 ${r.skipped ?? 0}`);
                } catch (err) {
                  setStatus(String(err));
                }
                ev.target.value = "";
              }}
            />
          </label>
        </div>
        {status && <p className="text-sm text-emerald-300">{status}</p>}
        <Link href="/admin" className="inline-block rounded-md border border-slate-500 px-4 py-2 text-sm text-slate-200">
          打開完整學生管理明細
        </Link>
      </div>
    </BackendShell>
  );
}
