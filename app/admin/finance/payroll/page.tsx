"use client";

import { useState } from "react";
import BackendShell from "../../../../components/backend-shell";

export default function AdminFinancePayrollPage() {
  const [status, setStatus] = useState("");

  function exportPayrollCsv() {
    const lines = ["coach_name,total_classes,total_pay", "Coach Demo,12,7200"];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payroll.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <BackendShell title="薪酬 / 出勤報表">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">薪酬計算 (Payroll)</h2>
        <p className="text-sm text-slate-400">
          Demo 版頁面：根據教練出勤與課堂記錄計算薪酬，提供月結報表導出。
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportPayrollCsv}>
            匯出 payroll.csv
          </button>
          <label className="cursor-pointer rounded-md border border-[#333] px-3 py-2 text-sm text-slate-200">
            匯入 CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                const count = Math.max(0, text.split("\n").length - 1);
                setStatus(`已讀取 ${count} 筆薪酬資料（Demo 預覽）`);
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
