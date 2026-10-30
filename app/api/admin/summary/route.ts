/**
 * [F004][S001]
 * Feature: Admin Reports & Financials
 * Step: (see Logic)
 * Logic: Mock API: admin export, import, summary helpers.
 */

/*
 * Next.js mock — GET /api/admin/summary (same shape as FastAPI admin_summary).
 * Requires mock Bearer (mock-token-dev). Used when NEXT_PUBLIC_API_BASE_URL is empty.
 */

import { NextResponse } from "next/server";
import { mockApiStore } from "../../../../lib/mock-api-store";
import { mockInstallmentRows, summarizeMockInstallments } from "../../../../lib/mock-installments";

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/** [F004][S008] Last 7 HK calendar days with mock check-in counts. */
function checkinBuckets(): { today: number; month: number; last_7_days: { date: string; count: number }[] } {
  const base = mockApiStore.checkinCount;
  const weekCounts = [3, 5, 2, 0, 4, 6, 2];
  const days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
    days.push({ date, count: weekCounts[6 - i] });
  }
  const monthKey = days[days.length - 1]?.date.slice(0, 7) ?? "";
  const month = days.filter((d) => d.date.startsWith(monthKey)).reduce((sum, d) => sum + d.count, 0);
  return { today: days[days.length - 1]?.count ?? base, month, last_7_days: days };
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.includes("mock-token-dev")) return unauthorized();

  const list = mockApiStore.students;
  const total_students = list.length;
  const active_students = list.filter((s) => s.lesson_balance > 0).length;
  const checkins = checkinBuckets();
  const total_checkins =
    mockApiStore.checkinCount + checkins.last_7_days.reduce((sum, d) => sum + d.count, 0);
  const installmentRows = mockInstallmentRows();
  const installmentSummary = summarizeMockInstallments(installmentRows);

  return NextResponse.json({
    total_students,
    active_students,
    total_checkins,
    checkins_total: total_checkins,
    checkins: total_checkins,
    checkins_count: total_checkins,
    checkins_today: checkins.today,
    checkins_this_month: checkins.month,
    checkins_last_7_days: checkins.last_7_days,
    installment_students_total: installmentSummary.students_total,
    installment_students_unpaid: installmentSummary.students_unpaid,
    installment_periods_total: installmentSummary.periods_total,
    installment_periods_unpaid: installmentSummary.periods_unpaid,
    installment_periods_paid: installmentSummary.periods_paid,
    installment_outstanding_amount: installmentSummary.outstanding_amount,
    whatsapp_messages: 0,
    whatsapp_logs_count: 0,
    audit_logs: 0,
    branches: 0,
    coaches: 0,
    courses: 0
  });
}
