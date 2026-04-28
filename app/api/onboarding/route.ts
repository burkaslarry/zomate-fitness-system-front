/** @feature [F01.1][F02.3] */

import { NextResponse } from "next/server";
import { computeMembershipExpiryIso } from "../../../lib/schemas/student";
import { registerStudentFromJson } from "../../../lib/register-student";
import { mockApiStore } from "../../../lib/mock-api-store";

/** Legacy onboarding (minimal fields) — new flow uses POST /api/v1/students/register. */
export async function POST(req: Request) {
  const b = (await req.json()) as Record<string, unknown>;

  if (b.hkid && b.parq && b.digital_signature) {
    try {
      const result = registerStudentFromJson(b);
      return NextResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const full_name = String(b.full_name ?? "");
  const phone = String(b.phone ?? "");
  if (!full_name || !phone) {
    return NextResponse.json({ error: "缺少姓名或電話" }, { status: 400 });
  }
  const plan = b.plan === "30" || b.plan === 30 ? 30 : 10;
  const row = mockApiStore.registerStudent({
    full_name,
    phone,
    hkid: "Z999999A",
    lesson_balance: plan,
    membership_expiry_iso: computeMembershipExpiryIso(plan as 10 | 30, new Date()),
    package_sessions: plan as 10 | 30,
    email: b.email ? String(b.email) : undefined
  });
  // eslint-disable-next-line no-console
  console.log(`[mock WhatsApp welcome] → ${phone}: Congrats! You have ${plan} sessions. PIN ${row.pin_code}`);
  return NextResponse.json({ pin_code: row.pin_code, student: row });
}
