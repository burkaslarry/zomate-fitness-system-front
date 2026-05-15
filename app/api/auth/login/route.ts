/**
 * [F006][S002]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: Mock API: auth login, logout, me.
 */

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json()) as { username?: string; password?: string };
  const u = String(body.username ?? "").trim();
  const p = String(body.password ?? "");
  if (u && p === "12345678") {
    return NextResponse.json({
      token: "mock-token-dev",
      username: u === "masterzoe" ? "masterzoe" : u,
      role: "ADMIN" as const
    });
  }
  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
