/**
 * [F001][S001]
 * Feature: Student Onboarding
 * Step: (see Logic)
 * Logic: Mock API route: registration POST.
 */

import { NextResponse } from "next/server";
import { registerStudentFromJson } from "../../../../../lib/register-student";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    const result = registerStudentFromJson(body);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
