/*
 * Next.js mock — GET /api/admin/summary (same shape as FastAPI admin_summary).
 * Requires mock Bearer (mock-token-dev). Used when NEXT_PUBLIC_API_BASE_URL is empty.
 */

import { NextResponse } from "next/server";
import { mockApiStore } from "../../../../lib/mock-api-store";

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.includes("mock-token-dev")) return unauthorized();

  const list = mockApiStore.students;
  const total_students = list.length;
  const active_students = list.filter((s) => s.lesson_balance > 0).length;
  const total_checkins = mockApiStore.ledger.length;

  return NextResponse.json({
    total_students,
    active_students,
    total_checkins,
    checkins_total: total_checkins,
    checkins: total_checkins,
    checkins_count: total_checkins,
    whatsapp_messages: 0,
    whatsapp_logs_count: 0,
    audit_logs: 0,
    branches: 0,
    coaches: 0,
    courses: 0
  });
}
