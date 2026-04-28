/** @feature [AUTH] Mock auth when Spring Boot is not running. */

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
