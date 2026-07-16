/**
 * [F004][S002]
 * Feature: Admin Reports & Financials
 * Step: Expenses report excluded from admin-managed reports
 * Logic: 支出管理 removed from system reports; old links redirect to sales.
 */

import { redirect } from "next/navigation";

export default function AdminFinanceExpensesRedirectPage() {
  redirect("/admin/finance/sales");
}
