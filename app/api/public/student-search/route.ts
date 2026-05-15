/**
 * [F003][S001]
 * Feature: Attendance & Today-Only QR Check-in
 * Step: (see Logic)
 * Logic: Mock API: public student lookup for check-in.
 */

import { NextResponse } from "next/server";
import { mockApiStore } from "../../../../lib/mock-api-store";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const rows = mockApiStore.searchStudents(q).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    phone: s.phone,
    lesson_balance: s.lesson_balance
  }));
  return NextResponse.json(rows);
}
