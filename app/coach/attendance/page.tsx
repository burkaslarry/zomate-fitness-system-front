"use client";

/**
 * [F008][S005]
 * Feature: Coach Session Management
 * Step: Staff attendance ledger at /coach/attendance (alias /attendance)
 */

import BackendShell from "../../../components/backend-shell";
import CoachAttendanceLedgerTable from "../../../components/coach-attendance-ledger-table";
import { getAuthSession } from "../../../lib/auth";

export default function CoachAttendanceReportPage() {
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const s = getAuthSession();
    if (!s) return;
    if (s.role === "COACH") {
      window.location.replace("/coach-portal/report");
      return;
    }
    if (s.role !== "ADMIN" && s.role !== "CLERK") {
      setDenied(true);
      setReady(true);
      return;
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  if (denied) {
    return (
      <BackendShell title="教練出勤">
        <p className="text-sm text-ink/70">此頁面僅供職員帳號使用。</p>
      </BackendShell>
    );
  }

  return (
    <BackendShell title="教練出勤">
      <CoachAttendanceLedgerTable backHref="/coach" backLabel="教練上堂" />
    </BackendShell>
  );
}
