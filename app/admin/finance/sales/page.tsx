"use client";

import { useState } from "react";
import BackendShell from "../../../../components/backend-shell";

export default function AdminFinanceSalesPage() {
  const [status, setStatus] = useState("");

  function exportSalesCsv() {
    const lines = ["invoice_no,student_name,amount,status", "INV-001,Larry Lo,1280,PAID"];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <BackendShell title="銷售與分期">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">銷售紀錄 (Sales Records)</h2>
        <p className="text-sm text-slate-400">Demo 版頁面：集中查看買堂紀錄、分期付款進度與收款狀態。</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportSalesCsv}>
            匯出 sales.csv
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
                setStatus(`已讀取 ${count} 筆銷售資料（Demo 預覽）`);
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
