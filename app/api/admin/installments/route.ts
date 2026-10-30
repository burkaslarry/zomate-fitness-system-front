/**
 * [F004][S008]
 * Feature: Admin Reports & Financials
 * Step: 分期付款學生 board (mock)
 * Logic: Same shape as FastAPI GET /api/admin/installments; summary always covers all rows.
 */

import { NextResponse } from "next/server";
import { mockInstallmentRows, summarizeMockInstallments } from "../../../../lib/mock-installments";

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.includes("mock-token-dev")) return unauthorized();

  const onlyUnpaid = new URL(req.url).searchParams.get("only_unpaid") === "true";
  const all = mockInstallmentRows();
  const summary = summarizeMockInstallments(all);
  const rows = onlyUnpaid ? all.filter((r) => r.unpaid_installments > 0) : all;
  return NextResponse.json({ rows, summary });
}
