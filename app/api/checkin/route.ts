/** @feature [F03.2][F03.3] */

import { NextResponse } from "next/server";
import { mockApiStore } from "../../../lib/mock-api-store";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    student_id?: number;
    phone?: string;
    pin_code: string;
  };
  const pin = String(body.pin_code ?? "").trim();
  if (pin.length < 4) {
    return NextResponse.json({ error: "PIN 無效" }, { status: 400 });
  }
  const updated = mockApiStore.checkIn({
    student_id: body.student_id,
    phone: body.phone,
    pin_code: pin
  });
  if (!updated) {
    return NextResponse.json({ error: "簽到失敗（電話／學生／PIN 或餘額）" }, { status: 400 });
  }
  // eslint-disable-next-line no-console
  console.log(`WhatsApp sent to ${updated.phone}`);
  // eslint-disable-next-line no-console
  console.log(
    `[mock] To student: Remaining lessons: ${updated.lesson_balance}. To coach: Student ${updated.full_name} checked in.`
  );
  return NextResponse.json({
    student: {
      id: updated.id,
      full_name: updated.full_name,
      phone: updated.phone,
      lesson_balance: updated.lesson_balance
    }
  });
}
