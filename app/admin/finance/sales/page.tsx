"use client";

/**
 * [F004][S001]
 * Feature: Admin Reports & Financials
 * Step: (see Logic)
 * Logic: Finance and reports UI: sales, expenses, payroll.
 */

import BackendShell from "../../../../components/backend-shell";
import MonthlySalesReport from "../../../../components/monthly-sales-report";

export default function AdminFinanceSalesPage() {
  return (
    <BackendShell title="銷售與分期">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="text-sm text-ink/55">集中查看買堂紀錄、分期與收款狀態。</p>
        </div>
        <MonthlySalesReport />
      </div>
    </BackendShell>
  );
}
