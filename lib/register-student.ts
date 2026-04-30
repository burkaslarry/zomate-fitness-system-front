/** @feature [F01.1][F01.3] */

import { computeMembershipExpiryIso, studentRegistrationPayloadSchema } from "./schemas/student";
import { mockApiStore, type MockStudent } from "./mock-api-store";

export type RegisterResult = {
  ok: true;
  student: MockStudent;
  pin_code: string;
  membership_expiry_iso: string;
  whatsapp_preview: string;
};

export function registerStudentFromJson(body: unknown): RegisterResult {
  const data = studentRegistrationPayloadSchema.parse(body);
  const packageSessions = data.package_sessions ?? 10;
  const start = new Date();
  const membership_expiry_iso = computeMembershipExpiryIso(packageSessions, start);
  const row = mockApiStore.registerStudent({
    full_name: data.full_name,
    phone: data.phone,
    hkid: data.hkid.toUpperCase(),
    lesson_balance: packageSessions,
    membership_expiry_iso,
    package_sessions: packageSessions,
    email: data.email || undefined
  });
  const whatsapp_preview = `Congrats! You have ${packageSessions} sessions. PIN: ${row.pin_code}. Expires: ${membership_expiry_iso}`;
  // eslint-disable-next-line no-console
  console.log(`[mock WhatsApp] → ${data.phone}: ${whatsapp_preview}`);
  return {
    ok: true,
    student: row,
    pin_code: row.pin_code,
    membership_expiry_iso,
    whatsapp_preview
  };
}
