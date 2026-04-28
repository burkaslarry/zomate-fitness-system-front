/** @feature [F04.2][F04.4] */

import { NextResponse } from "next/server";
import { expenseEntryFormSchema } from "../../../../../lib/schemas/report";
import { mockApiStore } from "../../../../../lib/mock-api-store";

export async function GET() {
  return NextResponse.json({ rows: mockApiStore.expenses });
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as unknown;
    const data = expenseEntryFormSchema.parse(raw);
    const row = mockApiStore.appendExpense({
      category: data.category,
      amount: data.amount,
      date: data.date,
      memo: data.memo,
      invoiceRef: data.invoiceRef
    });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
