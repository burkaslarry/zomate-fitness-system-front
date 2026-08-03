"use client";

/**
 * [F004][S005]
 * Feature: Admin Reports & Financials
 * Step: Coach Attendance Income Export page (replaces payroll redirect)
 * Logic: Admin-only unified finance export for coach commission prep in Excel.
 */

import { useEffect, useState } from "react";
import BackendShell from "../../../../components/backend-shell";
import CoachAttendanceIncomeExport from "../../../../components/coach-attendance-income-export";
import { getAuthSession } from "../../../../lib/auth";

export default function AdminFinancePayrollPage() {
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const s = getAuthSession();
    if (!s) return;
    const accessRole = s.accessRole ?? (s.role === "ADMIN" ? "MASTER_ADMIN" : s.role === "COACH" ? "COACH" : "CLERK");
    if (accessRole !== "MASTER_ADMIN") {
      setDenied(true);
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  if (denied) {
    return (
      <BackendShell title="教練出勤收入匯出">
        <p className="text-sm text-ink/70">此頁面僅供管理員帳號使用。</p>
      </BackendShell>
    );
  }

  return (
    <BackendShell title="教練出勤收入匯出">
      <div className="mx-auto max-w-6xl">
        <CoachAttendanceIncomeExport />
      </div>
    </BackendShell>
  );
}
