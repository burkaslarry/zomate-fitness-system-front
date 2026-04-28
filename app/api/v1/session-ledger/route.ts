/** @feature [F03.5][F04.2] */

import { NextResponse } from "next/server";
import { sessionLedgerEntrySchema, isLateCancellation } from "../../../../lib/schemas/report";
import { mockApiStore } from "../../../../lib/mock-api-store";

export async function GET() {
  return NextResponse.json({ entries: mockApiStore.ledger });
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as unknown;
    const parsed = sessionLedgerEntrySchema.parse(raw);
    if (
      parsed.reason === "late_cancel" &&
      parsed.cancelledAtIso &&
      isLateCancellation(parsed.sessionStartIso, parsed.cancelledAtIso)
    ) {
      /* eslint-disable no-console */
      console.log("[ledger] Late cancellation within 24h — charge policy applies (demo flag).");
      /* eslint-enable no-console */
    }
    mockApiStore.appendLedger(parsed);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
