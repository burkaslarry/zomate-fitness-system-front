/*
 * Next.js Route Handler — GET /api/admin/students/export.csv (mock store).
 *
 * When NEXT_PUBLIC_API_BASE_URL is empty, the SPA calls same-origin routes with the
 * mock Bearer token (mock-token-dev). Column layout matches FastAPI export_students_csv.
 */

import { NextResponse } from "next/server";
import { csvRow } from "../../../../../lib/csv-rfc4180";
import { mockApiStore } from "../../../../../lib/mock-api-store";

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(_req: Request) {
  const auth = _req.headers.get("authorization");
  if (!auth?.includes("mock-token-dev")) return unauthorized();

  const header = csvRow([
    "full_name",
    "phone",
    "email",
    "health_notes",
    "disclaimer_accepted",
    "pin_code",
    "lesson_balance",
    "face_id_external"
  ]);

  const lines = mockApiStore.students.map((s) =>
    csvRow([
      s.full_name,
      s.phone,
      s.email ?? "",
      "",
      "1",
      s.pin_code,
      s.lesson_balance,
      ""
    ])
  );

  const body = [header, ...lines].join("\n") + "\n";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="students.csv"'
    }
  });
}
