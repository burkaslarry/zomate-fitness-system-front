"use client";

import BackendShell from "../../../../components/backend-shell";

export default function AdminFinancePayrollPage() {
  return (
    <BackendShell title="薪酬 / 出勤報表">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">薪酬計算 (Payroll)</h2>
        <p className="text-sm text-slate-400">
          Demo 版頁面：根據教練出勤與課堂記錄計算薪酬，提供月結報表導出。
        </p>
      </div>
    </BackendShell>
  );
}
