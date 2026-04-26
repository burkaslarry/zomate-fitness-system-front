"use client";

import BackendShell from "../../../../components/backend-shell";

export default function AdminFinanceSalesPage() {
  return (
    <BackendShell title="銷售與分期">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">銷售紀錄 (Sales Records)</h2>
        <p className="text-sm text-slate-400">Demo 版頁面：集中查看買堂紀錄、分期付款進度與收款狀態。</p>
      </div>
    </BackendShell>
  );
}
