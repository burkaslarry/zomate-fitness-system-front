/**
 * [F007][S004]
 * Feature: Backend platform (FastAPI & PostgreSQL)
 * Step: (see Logic)
 * Logic: Mock API: health probes mirroring FastAPI paths.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", service: "zomate-mock" });
}
