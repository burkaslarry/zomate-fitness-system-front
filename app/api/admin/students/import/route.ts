/*
 * Next.js Route Handler — POST /api/admin/students/import (multipart file field).
 *
 * Mirrors FastAPI behaviour at a high level: skip duplicate phones, append rows via
 * mockApiStore.registerStudent. Requires mock Bearer (mock-token-dev).
 */

import { NextResponse } from "next/server";
import { dictRowsFromCsv } from "../../../../../lib/csv-rfc4180";
import { mockApiStore } from "../../../../../lib/mock-api-store";

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function defaultExpiryIso(): string {
  const exp = new Date();
  exp.setMonth(exp.getMonth() + 3);
  return exp.toISOString();
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.includes("mock-token-dev")) return unauthorized();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const raw = await file.text();
  const rows = dictRowsFromCsv(raw);
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const full_name = (row.full_name ?? "").trim();
    const phone = (row.phone ?? "").trim();
    if (!full_name || !phone) {
      skipped += 1;
      continue;
    }
    if (mockApiStore.findByPhone(phone)) {
      skipped += 1;
      continue;
    }
    let balance = 0;
    try {
      balance = Number.parseInt((row.lesson_balance ?? "0").trim() || "0", 10);
      if (!Number.isFinite(balance)) balance = 0;
    } catch {
      skipped += 1;
      continue;
    }
    const pin_raw = (row.pin_code ?? "").trim();
    mockApiStore.registerStudent({
      full_name,
      phone,
      hkid: `Z${Date.now().toString().slice(-7)}`,
      lesson_balance: balance,
      pin_code: pin_raw || undefined,
      membership_expiry_iso: defaultExpiryIso(),
      package_sessions: balance >= 20 ? 30 : 10,
      email: (row.email ?? "").trim() || undefined
    });
    imported += 1;
  }

  return NextResponse.json({ imported, skipped });
}
