/** @feature [AUTH] */

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.includes("mock-token-dev")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ username: "masterzoe", role: "ADMIN" });
}
