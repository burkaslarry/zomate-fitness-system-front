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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100) || 100));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const all = mockApiStore.students.map((s) => ({
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
  const items = all.slice(offset, offset + limit);
  return NextResponse.json({
    items,
    total: all.length,
    limit,
    offset,
    total_all: all.length,
    active_count: all.filter((s) => s.lesson_balance > 0).length,
    medical_pending_count: 0
  });
}
