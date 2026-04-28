/*
 * Next.js Route Handler — GET /api/students (mock store).
 * Mirrors FastAPI ``GET /api/students`` (no auth on backend) — used when FastAPI is down.
 */

import { NextResponse } from "next/server";
import { mockApiStore } from "../../../lib/mock-api-store";

export async function GET() {
  const rows = mockApiStore.students.map((s) => ({
    id: s.id,
    full_name: s.full_name,
    phone: s.phone,
    email: s.email ?? "",
    health_notes: "",
    disclaimer_accepted: true,
    pin_code: s.pin_code,
    lesson_balance: s.lesson_balance,
    face_id_external: ""
  }));

  return NextResponse.json(rows);
}
