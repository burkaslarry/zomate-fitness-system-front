/** @feature [F04.3] */

import { NextResponse } from "next/server";
import { mockApiStore } from "../../../../../lib/mock-api-store";

export async function GET() {
  return NextResponse.json({ rows: mockApiStore.coachAttendance });
}
