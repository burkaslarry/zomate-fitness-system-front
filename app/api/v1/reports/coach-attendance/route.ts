/** @feature [F04.3] */

import { NextResponse } from "next/server";
import { mockApiStore } from "../../../../../lib/mock-api-store";

export async function GET(req: Request) {
  const month = new URL(req.url).searchParams.get("month");
  let lessons = [...mockApiStore.coachAttendanceLessons];
  if (month && month.length >= 7) {
    lessons = lessons.filter((r) => r.sessionTimeIso.slice(0, 7) === month);
  }
  const summary =
    month && month.length >= 7
      ? mockApiStore.coachAttendance.filter((s) => s.month === month)
      : [...mockApiStore.coachAttendance];
  return NextResponse.json({ rows: lessons, summary, month: month ?? undefined });
}
