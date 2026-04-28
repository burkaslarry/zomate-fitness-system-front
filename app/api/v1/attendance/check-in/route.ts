/** @feature [F03.2][F03.3] */

import { NextResponse } from "next/server";
import { mockApiStore } from "../../../../../lib/mock-api-store";

type Body = {
  phone?: string;
  student_id?: number;
  pin_code: string;
  studentNameHint?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const pin = String(body.pin_code ?? "").trim();
  if (pin.length < 4) {
    return NextResponse.json({ error: "invalid_pin" }, { status: 400 });
  }
  const updated = mockApiStore.checkIn({
    student_id: body.student_id,
    phone: body.phone,
    pin_code: pin
  });
  if (!updated) {
    return NextResponse.json({ error: "checkin_failed" }, { status: 400 });
  }
  const phone = updated.phone;
  // eslint-disable-next-line no-console
  console.log(`WhatsApp sent to ${phone}`);
  // eslint-disable-next-line no-console
  console.log(
    `[mock] To student ${phone}: Remaining lessons: ${updated.lesson_balance}. To coach: Student ${updated.full_name} has taken lesson (balance ${updated.lesson_balance}).`
  );
  return NextResponse.json({
    ok: true,
    student: {
      id: updated.id,
      full_name: updated.full_name,
      phone: updated.phone,
      lesson_balance: updated.lesson_balance
    },
    whatsapp_sent_to: phone
  });
}
