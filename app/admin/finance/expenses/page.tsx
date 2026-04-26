"use client";

import BackendShell from "../../../../components/backend-shell";

export default function AdminFinanceExpensesPage() {
  return (
    <BackendShell title="支出管理">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">支出管理 (Expense Tracking)</h2>
        <p className="text-sm text-slate-400">Demo 版頁面：給 Fung 入單、標記支出類型、生成月度支出報告。</p>
      </div>
    </BackendShell>
  );
}
