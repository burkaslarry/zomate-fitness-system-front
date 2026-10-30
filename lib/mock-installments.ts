/**
 * [F004][S008]
 * Feature: Admin Reports & Financials
 * Step: Mock 分期 ledger
 * Logic: Same shape as GET /api/admin/installments; dashboard summary and board share these rows.
 */

import type {
  InstallmentLedgerPeriod,
  InstallmentLedgerRow,
  InstallmentLedgerSummary
} from "../types/api";

function hkDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

function paidAt(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

function period(
  installment_no: number,
  amount: number,
  paid: boolean,
  dueOffsetDays: number,
  lessonFrom: number | null,
  lessonTo: number | null,
  paidDaysAgo = 0
): InstallmentLedgerPeriod {
  return {
    installment_no,
    amount,
    paid,
    paid_at: paid ? paidAt(paidDaysAgo) : null,
    due_date: hkDate(dueOffsetDays),
    lesson_from: lessonFrom,
    lesson_to: lessonTo
  };
}

function row(
  base: Omit<
    InstallmentLedgerRow,
    "paid_installments" | "unpaid_installments" | "paid_amount" | "outstanding_amount" | "next_installment_no" | "next_due_date" | "status"
  >
): InstallmentLedgerRow {
  const paid = base.periods.filter((p) => p.paid);
  const unpaid = base.periods.filter((p) => !p.paid);
  const paidAmount = paid.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const pendingAmount = unpaid.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const next = unpaid[0];
  return {
    ...base,
    paid_installments: paid.length,
    unpaid_installments: unpaid.length,
    paid_amount: paidAmount,
    outstanding_amount: pendingAmount,
    next_installment_no: next?.installment_no ?? null,
    next_due_date: next?.due_date ?? null,
    status: unpaid.length === 0 ? "completed" : "active"
  };
}

const MOCK_ROWS: InstallmentLedgerRow[] = [
  row({
    id: "course-9101",
    source: "course",
    source_id: 9101,
    student_id: 1,
    student_name: "Larry Lo",
    student_phone: "+85291234567",
    label: "PT 套餐 A · 12 堂（3 期）",
    coach_name: "Coach A",
    branch_id: 1,
    branch_name: "銅鑼灣",
    branch_code: "CWB",
    total_installments: 3,
    total_amount: 9000,
    course_enrollment_id: 9101,
    periods: [
      period(1, 3000, true, -35, 1, 4, 34),
      period(2, 3000, false, 5, 5, 8),
      period(3, 3000, false, 35, 9, 12)
    ]
  }),
  row({
    id: "course-9102",
    source: "course",
    source_id: 9102,
    student_id: 2,
    student_name: "Mandy Chan",
    student_phone: "+85292345678",
    label: "PT 套餐 B · 9 堂（3 期）",
    coach_name: "Coach B",
    branch_id: 2,
    branch_name: "尖沙咀",
    branch_code: "TST",
    total_installments: 3,
    total_amount: 7500,
    course_enrollment_id: 9102,
    periods: [
      period(1, 2500, true, -60, 1, 3, 58),
      period(2, 2500, true, -30, 4, 6, 29),
      period(3, 2500, false, 12, 7, 9)
    ]
  }),
  row({
    id: "category-9201",
    source: "category",
    source_id: 9201,
    student_id: 3,
    student_name: "Jason Wong",
    student_phone: "+85293456789",
    label: "Group Class 月費計劃（2 期）",
    coach_name: null,
    branch_id: null,
    branch_name: null,
    branch_code: null,
    total_installments: 2,
    total_amount: 4000,
    category_enrollment_id: 9201,
    installment_plan_id: 9201,
    periods: [period(1, 2000, true, -20, null, null, 19), period(2, 2000, false, 10, null, null)]
  })
];

export function mockInstallmentRows(): InstallmentLedgerRow[] {
  return MOCK_ROWS;
}

export function summarizeMockInstallments(rows: InstallmentLedgerRow[]): InstallmentLedgerSummary {
  const students = new Set(rows.map((r) => r.student_id));
  const studentsUnpaid = new Set(rows.filter((r) => r.unpaid_installments > 0).map((r) => r.student_id));
  return {
    students_total: students.size,
    students_unpaid: studentsUnpaid.size,
    periods_total: rows.reduce((sum, r) => sum + r.total_installments, 0),
    periods_unpaid: rows.reduce((sum, r) => sum + r.unpaid_installments, 0),
    periods_paid: rows.reduce((sum, r) => sum + r.paid_installments, 0),
    outstanding_amount: rows.reduce((sum, r) => sum + (r.outstanding_amount ?? 0), 0)
  };
}
