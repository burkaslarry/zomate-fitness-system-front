/**
 * [F004][S003]
 * Feature: Admin Reports & Financials
 * Step: Salary / attendance report excluded from admin-managed reports
 * Logic: 薪酬／出勤報表 removed; coaches mark own attendance. Old links → sales.
 */

import { redirect } from "next/navigation";

export default function AdminFinancePayrollRedirectPage() {
  redirect("/admin/finance/sales");
}
