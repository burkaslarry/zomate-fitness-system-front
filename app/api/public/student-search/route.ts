/** @feature [F02.2][F03.1] */

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
