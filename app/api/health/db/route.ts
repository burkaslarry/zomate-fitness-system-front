import { NextResponse } from "next/server";

/** Next mock — aligns shape with FastAPI ``GET /api/health/db`` when ``NEXT_PUBLIC_USE_NEXT_MOCK_API=1``. */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    database: "connected",
    service: "zomate-next-mock"
  });
}
