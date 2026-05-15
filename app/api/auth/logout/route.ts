/**
 * [F006][S002]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: Mock API: auth login, logout, me.
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true });
}
