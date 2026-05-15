/**
 * [F003][S001]
 * Feature: Attendance & Today-Only QR Check-in
 * Step: (see Logic)
 * Logic: Mock API: today's lesson rows for student check-in picker.
 */

import { NextResponse } from "next/server";
import { mockApiStore } from "../../../../lib/mock-api-store";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("student_id") ?? "";
  const studentId = Number.parseInt(raw, 10);
  if (!Number.isFinite(studentId) || studentId < 1) {
    return NextResponse.json({ detail: "student_id required" }, { status: 400 });
  }
  if (!mockApiStore.findById(studentId)) {
    return NextResponse.json({ detail: "Student not found." }, { status: 404 });
  }
  const rows = mockApiStore.todayLessonsForStudent(studentId);
  return NextResponse.json(rows);
}
