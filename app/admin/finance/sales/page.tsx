"use client";

import BackendShell from "../../../../components/backend-shell";
import MonthlySalesReport from "../../../../components/monthly-sales-report";

export default function AdminFinanceSalesPage() {
  return (
    <BackendShell title="銷售與分期">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">集中查看買堂紀錄、分期與收款狀態（含月度報表）。</p>
            <p className="mt-2 text-xs text-zinc-500">
              CSV／PostgreSQL 權威資料經 FastAPI（
              <code className="rounded bg-[#262626] px-1">zomate-fitness-system-back</code>
              ，表前缀 <code className="rounded bg-[#262626] px-1">zomate_fs_*</code>
              ）；下方表格支援 Excel（exceljs）匯出。
            </p>
          </div>
        </div>
        <MonthlySalesReport />
      </div>
    </BackendShell>
  );
}
