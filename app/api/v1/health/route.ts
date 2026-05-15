/**
 * [F006][S001]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: Next.js module: default platform and trace bucket.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", version: "v1-mock" });
}
