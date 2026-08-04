"use client";

/**
 * [F008][S005] Alias route → staff attendance ledger.
 */

import { useEffect } from "react";

export default function AttendanceAliasPage() {
  useEffect(() => {
    window.location.replace("/coach/attendance");
  }, []);
  return null;
}
