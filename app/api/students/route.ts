/**
 * [F001][S001]
 * Feature: Student Onboarding
 * Step: (see Logic)
 * Logic: Mock API: generic students route.
 */

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
    date_of_birth: s.date_of_birth ?? null,
    health_notes: "",
    disclaimer_accepted: true,
    pin_code: s.pin_code,
    lesson_balance: s.lesson_balance,
    face_id_external: "",
    current_course_package_status: s.lesson_balance > 0 ? "Active package" : "No active package",
    last_checkin_at: null
  }));

  return NextResponse.json(rows);
}
