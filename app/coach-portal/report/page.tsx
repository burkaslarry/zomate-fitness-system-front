"use client";

/**
 * [F008][S005]
 * Feature: Coach Session Management
 * Step: Coach portal attendance ledger
 */

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { getAuthSession } from "../../../lib/auth";
import CoachAttendanceLedgerTable from "../../../components/coach-attendance-ledger-table";

type CoachMe = { id: number; full_name: string };

export default function CoachPortalReportPage() {
  const [coach, setCoach] = useState<CoachMe | null>(null);

  useEffect(() => {
    const s = getAuthSession();
    if (s?.role !== "COACH") return;
    void api
      .coachMe()
      .then((me) => setCoach(me as CoachMe))
      .catch(() => setCoach(null));
  }, []);

  if (!coach) return <p className="text-sm text-ink/50">載入教練資料…</p>;

  return (
    <CoachAttendanceLedgerTable
      fixedCoachId={coach.id}
      showCoachFilter={false}
    />
  );
}
