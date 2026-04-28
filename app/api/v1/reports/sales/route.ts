/** @feature [F04.1] */

import { NextResponse } from "next/server";
import { mockApiStore } from "../../../../../lib/mock-api-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort");
  const rows = [...mockApiStore.sales];
  if (sort?.includes("amount:desc")) {
    rows.sort((a, b) => b.amount - a.amount);
  } else if (sort?.includes("date:desc")) {
    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  return NextResponse.json({ rows, meta: { source: "mock-api", sort } });
}
