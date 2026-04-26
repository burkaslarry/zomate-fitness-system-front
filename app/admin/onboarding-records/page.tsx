"use client";

import { useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { csvUrl, uploadCsv } from "../../../lib/api";

export default function AdminOnboardingRecordsPage() {
  const [status, setStatus] = useState("");

  return (
    <BackendShell title="入職紀錄 / 健康表單">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">入職紀錄 (Onboarding Records)</h2>
        <p className="text-sm text-slate-400">
          Demo 版頁面：用作展示新學生資料、健康聲明與免責條款提交記錄。正式版可在此加入 PDF 檢視與篩選。
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={csvUrl.studentsExport()} className="rounded-md border border-[#333] px-3 py-2 text-sm text-slate-200">
            匯出 onboarding.csv
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
                  setStatus(`匯入完成：${r.imported ?? 0} 筆`);
                } catch (err) {
                  setStatus(String(err));
                }
                ev.target.value = "";
              }}
            />
          </label>
        </div>
        {status && <p className="text-sm text-emerald-300">{status}</p>}
      </div>
    </BackendShell>
  );
}
